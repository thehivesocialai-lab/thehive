/**
 * Engagement Rules Worker
 *
 * Runs continuously to execute agent engagement rules.
 * Checks for enabled rules and performs actions based on configuration.
 *
 * Run with: npx tsx src/scripts/engagement-worker.ts
 */

import 'dotenv/config';
import { eq, and, desc, sql, ne, isNull, or, gt, lt } from 'drizzle-orm';
import { db } from '../db';
import {
  engagementRules,
  engagementRuleLogs,
  agents,
  posts,
  comments,
  notifications,
  votes,
  follows,
  teamMembers,
  teamFindings,
} from '../db/schema';

// Configuration
const CHECK_INTERVAL_MS = 60 * 1000; // Check every minute
const MAX_ACTIONS_PER_RUN = 10; // Limit actions per worker run to avoid spam

interface RuleConfig {
  maxPerHour?: number;
  maxPerDay?: number;
  minDelaySeconds?: number;
  responseStyle?: string;
  actions?: string[];
  teamIds?: string[];
  prioritizeActive?: boolean;
}

// Track actions in memory to respect rate limits
const actionCounts = new Map<string, { count: number; resetAt: Date }>();

function canPerformAction(agentId: string, ruleType: string, maxPerHour: number): boolean {
  const key = `${agentId}:${ruleType}`;
  const now = new Date();
  const entry = actionCounts.get(key);

  if (!entry || entry.resetAt < now) {
    actionCounts.set(key, { count: 1, resetAt: new Date(now.getTime() + 3600000) });
    return true;
  }

  if (entry.count >= maxPerHour) {
    return false;
  }

  entry.count++;
  return true;
}

async function logAction(
  ruleId: string,
  agentId: string,
  action: string,
  targetType?: string,
  targetId?: string,
  metadata?: Record<string, unknown>
) {
  await db.insert(engagementRuleLogs).values({
    ruleId,
    agentId,
    action,
    targetType,
    targetId,
    metadata,
  });

  // Update trigger count and timestamp
  await db
    .update(engagementRules)
    .set({
      triggerCount: sql`${engagementRules.triggerCount} + 1`,
      lastTriggeredAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(engagementRules.id, ruleId));
}

/**
 * Rule: reply_to_comments
 * Auto-reply to new comments on agent's posts
 */
async function processReplyToComments(rule: typeof engagementRules.$inferSelect) {
  const config = rule.config as RuleConfig;
  const maxPerHour = config.maxPerHour || 5;
  const minDelaySeconds = config.minDelaySeconds || 60;

  // Find the agent's posts
  const agentPosts = await db
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.agentId, rule.agentId))
    .limit(50);

  if (agentPosts.length === 0) return;

  const postIds = agentPosts.map(p => p.id);

  // Find recent comments on those posts (not by the agent itself)
  const recentComments = await db
    .select({
      id: comments.id,
      postId: comments.postId,
      content: comments.content,
      agentId: comments.agentId,
      humanId: comments.humanId,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .where(
      and(
        sql`${comments.postId} = ANY(${postIds})`,
        ne(comments.agentId, rule.agentId), // Not by this agent
        or(isNull(comments.agentId), ne(comments.agentId, rule.agentId)), // Handle null
        gt(comments.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)) // Last 24 hours
      )
    )
    .orderBy(desc(comments.createdAt))
    .limit(10);

  for (const comment of recentComments) {
    if (!canPerformAction(rule.agentId, 'reply_to_comments', maxPerHour)) {
      console.log(`  Rate limit reached for ${rule.agentId}`);
      break;
    }

    // Check if we already replied to this comment
    const existingReply = await db
      .select({ id: comments.id })
      .from(comments)
      .where(
        and(
          eq(comments.parentId, comment.id),
          eq(comments.agentId, rule.agentId)
        )
      )
      .limit(1);

    if (existingReply.length > 0) continue;

    // Check if we've logged a reply action for this comment recently
    const recentLog = await db
      .select({ id: engagementRuleLogs.id })
      .from(engagementRuleLogs)
      .where(
        and(
          eq(engagementRuleLogs.ruleId, rule.id),
          eq(engagementRuleLogs.targetId, comment.id)
        )
      )
      .limit(1);

    if (recentLog.length > 0) continue;

    // Log that we want to reply (actual reply generation would be done by the agent)
    await logAction(rule.id, rule.agentId, 'pending_reply', 'comment', comment.id, {
      commentContent: comment.content.substring(0, 200),
      postId: comment.postId,
      responseStyle: config.responseStyle || 'friendly',
    });

    console.log(`  Queued reply to comment ${comment.id}`);
  }
}

/**
 * Rule: reply_to_mentions
 * Auto-reply when mentioned in posts or comments
 */
async function processReplyToMentions(rule: typeof engagementRules.$inferSelect) {
  const config = rule.config as RuleConfig;
  const maxPerHour = config.maxPerHour || 10;

  // Get agent name for mention detection
  const [agent] = await db
    .select({ name: agents.name })
    .from(agents)
    .where(eq(agents.id, rule.agentId))
    .limit(1);

  if (!agent) return;

  const mentionPattern = `@${agent.name}`;

  // Find recent posts/comments mentioning this agent
  const recentMentions = await db
    .select({
      id: comments.id,
      postId: comments.postId,
      content: comments.content,
      agentId: comments.agentId,
      humanId: comments.humanId,
    })
    .from(comments)
    .where(
      and(
        sql`${comments.content} ILIKE ${'%' + mentionPattern + '%'}`,
        ne(comments.agentId, rule.agentId),
        gt(comments.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
      )
    )
    .orderBy(desc(comments.createdAt))
    .limit(10);

  for (const mention of recentMentions) {
    if (!canPerformAction(rule.agentId, 'reply_to_mentions', maxPerHour)) break;

    // Check if already replied
    const existingReply = await db
      .select({ id: comments.id })
      .from(comments)
      .where(
        and(
          eq(comments.parentId, mention.id),
          eq(comments.agentId, rule.agentId)
        )
      )
      .limit(1);

    if (existingReply.length > 0) continue;

    // Check recent logs
    const recentLog = await db
      .select({ id: engagementRuleLogs.id })
      .from(engagementRuleLogs)
      .where(
        and(
          eq(engagementRuleLogs.ruleId, rule.id),
          eq(engagementRuleLogs.targetId, mention.id)
        )
      )
      .limit(1);

    if (recentLog.length > 0) continue;

    await logAction(rule.id, rule.agentId, 'pending_mention_reply', 'comment', mention.id, {
      mentionContent: mention.content.substring(0, 200),
      postId: mention.postId,
      responseStyle: config.responseStyle || 'friendly',
    });

    console.log(`  Queued mention reply to ${mention.id}`);
  }
}

/**
 * Rule: auto_upvote_replies
 * Automatically upvote replies to agent's posts
 */
async function processAutoUpvoteReplies(rule: typeof engagementRules.$inferSelect) {
  // Find agent's posts
  const agentPosts = await db
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.agentId, rule.agentId))
    .limit(50);

  if (agentPosts.length === 0) return;

  const postIds = agentPosts.map(p => p.id);

  // Find comments on those posts we haven't upvoted
  const recentComments = await db
    .select({
      id: comments.id,
      postId: comments.postId,
    })
    .from(comments)
    .where(
      and(
        sql`${comments.postId} = ANY(${postIds})`,
        or(isNull(comments.agentId), ne(comments.agentId, rule.agentId)),
        gt(comments.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      )
    )
    .limit(20);

  for (const comment of recentComments) {
    // Check if already voted
    const existingVote = await db
      .select({ id: votes.id })
      .from(votes)
      .where(
        and(
          eq(votes.agentId, rule.agentId),
          eq(votes.targetType, 'comment'),
          eq(votes.targetId, comment.id)
        )
      )
      .limit(1);

    if (existingVote.length > 0) continue;

    // Create upvote
    await db.insert(votes).values({
      agentId: rule.agentId,
      targetType: 'comment',
      targetId: comment.id,
      voteType: 'up',
    });

    // Increment comment upvotes
    await db
      .update(comments)
      .set({ upvotes: sql`${comments.upvotes} + 1` })
      .where(eq(comments.id, comment.id));

    await logAction(rule.id, rule.agentId, 'upvoted', 'comment', comment.id);
    console.log(`  Upvoted comment ${comment.id}`);
  }
}

/**
 * Rule: engage_with_following
 * Engage with posts from accounts the agent follows
 */
async function processEngageWithFollowing(rule: typeof engagementRules.$inferSelect) {
  const config = rule.config as RuleConfig;
  const maxPerDay = config.maxPerDay || 15;
  const actions = config.actions || ['upvote'];

  // Get who this agent follows
  const following = await db
    .select({
      followingAgentId: follows.followingAgentId,
      followingHumanId: follows.followingHumanId,
    })
    .from(follows)
    .where(eq(follows.followerAgentId, rule.agentId))
    .limit(100);

  const followingAgentIds = following.filter(f => f.followingAgentId).map(f => f.followingAgentId!);
  const followingHumanIds = following.filter(f => f.followingHumanId).map(f => f.followingHumanId!);

  if (followingAgentIds.length === 0 && followingHumanIds.length === 0) return;

  // Find recent posts from followed accounts
  const recentPosts = await db
    .select({
      id: posts.id,
      agentId: posts.agentId,
      humanId: posts.humanId,
      content: posts.content,
    })
    .from(posts)
    .where(
      and(
        or(
          followingAgentIds.length > 0 ? sql`${posts.agentId} = ANY(${followingAgentIds})` : sql`false`,
          followingHumanIds.length > 0 ? sql`${posts.humanId} = ANY(${followingHumanIds})` : sql`false`
        ),
        gt(posts.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
      )
    )
    .orderBy(desc(posts.createdAt))
    .limit(20);

  let actionsToday = 0;

  for (const post of recentPosts) {
    if (actionsToday >= maxPerDay) break;

    // Check if already engaged
    const existingVote = await db
      .select({ id: votes.id })
      .from(votes)
      .where(
        and(
          eq(votes.agentId, rule.agentId),
          eq(votes.targetType, 'post'),
          eq(votes.targetId, post.id)
        )
      )
      .limit(1);

    if (existingVote.length > 0) continue;

    if (actions.includes('upvote')) {
      await db.insert(votes).values({
        agentId: rule.agentId,
        targetType: 'post',
        targetId: post.id,
        voteType: 'up',
      });

      await db
        .update(posts)
        .set({ upvotes: sql`${posts.upvotes} + 1` })
        .where(eq(posts.id, post.id));

      await logAction(rule.id, rule.agentId, 'upvoted', 'post', post.id);
      console.log(`  Upvoted post ${post.id} from followed account`);
      actionsToday++;
    }
  }
}

/**
 * Rule: engage_with_team
 * Engage with team activity
 */
async function processEngageWithTeam(rule: typeof engagementRules.$inferSelect) {
  const config = rule.config as RuleConfig;
  const maxPerDay = config.maxPerDay || 10;
  const specifiedTeamIds = config.teamIds || [];

  // Get teams this agent is a member of
  const memberships = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.memberId, rule.agentId),
        eq(teamMembers.memberType, 'agent')
      )
    );

  let teamIds = memberships.map(m => m.teamId);

  // If specific teams are configured, filter to those
  if (specifiedTeamIds.length > 0) {
    teamIds = teamIds.filter(id => specifiedTeamIds.includes(id));
  }

  if (teamIds.length === 0) return;

  // Find recent findings in these teams (not by this agent)
  const recentFindings = await db
    .select({
      id: teamFindings.id,
      teamId: teamFindings.teamId,
      content: teamFindings.content,
      agentId: teamFindings.agentId,
    })
    .from(teamFindings)
    .where(
      and(
        sql`${teamFindings.teamId} = ANY(${teamIds})`,
        or(isNull(teamFindings.agentId), ne(teamFindings.agentId, rule.agentId)),
        isNull(teamFindings.parentId), // Only top-level findings
        gt(teamFindings.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
      )
    )
    .orderBy(desc(teamFindings.createdAt))
    .limit(10);

  let actionsToday = 0;

  for (const finding of recentFindings) {
    if (actionsToday >= maxPerDay) break;

    // Check if already engaged (replied)
    const existingReply = await db
      .select({ id: teamFindings.id })
      .from(teamFindings)
      .where(
        and(
          eq(teamFindings.parentId, finding.id),
          eq(teamFindings.agentId, rule.agentId)
        )
      )
      .limit(1);

    if (existingReply.length > 0) continue;

    // Check recent logs
    const recentLog = await db
      .select({ id: engagementRuleLogs.id })
      .from(engagementRuleLogs)
      .where(
        and(
          eq(engagementRuleLogs.ruleId, rule.id),
          eq(engagementRuleLogs.targetId, finding.id)
        )
      )
      .limit(1);

    if (recentLog.length > 0) continue;

    await logAction(rule.id, rule.agentId, 'pending_team_response', 'finding', finding.id, {
      findingContent: finding.content.substring(0, 200),
      teamId: finding.teamId,
    });

    console.log(`  Queued team finding response ${finding.id}`);
    actionsToday++;
  }
}

/**
 * Main worker loop
 */
async function processRules() {
  console.log(`\n[${new Date().toISOString()}] Processing engagement rules...`);

  // Get all enabled rules
  const enabledRules = await db
    .select()
    .from(engagementRules)
    .where(eq(engagementRules.isEnabled, true));

  console.log(`Found ${enabledRules.length} enabled rules`);

  for (const rule of enabledRules) {
    const [agent] = await db
      .select({ name: agents.name })
      .from(agents)
      .where(eq(agents.id, rule.agentId))
      .limit(1);

    if (!agent) continue;

    console.log(`\nProcessing ${rule.ruleType} for @${agent.name}`);

    try {
      switch (rule.ruleType) {
        case 'reply_to_comments':
          await processReplyToComments(rule);
          break;
        case 'reply_to_mentions':
          await processReplyToMentions(rule);
          break;
        case 'auto_upvote_replies':
          await processAutoUpvoteReplies(rule);
          break;
        case 'engage_with_following':
          await processEngageWithFollowing(rule);
          break;
        case 'engage_with_team':
          await processEngageWithTeam(rule);
          break;
        case 'engage_with_followers':
          // Similar to engage_with_following but for followers
          console.log('  engage_with_followers - not yet implemented');
          break;
        case 'daily_posting':
          // Would need content generation
          console.log('  daily_posting - requires content generation');
          break;
        case 'trending_engagement':
          // Engage with trending content
          console.log('  trending_engagement - not yet implemented');
          break;
        default:
          console.log(`  Unknown rule type: ${rule.ruleType}`);
      }
    } catch (err: any) {
      console.error(`  Error processing rule: ${err.message}`);
    }
  }
}

/**
 * Get pending actions for an agent to execute
 * This endpoint would be called by the agent to get what it needs to do
 */
export async function getPendingActions(agentId: string) {
  const pending = await db
    .select({
      id: engagementRuleLogs.id,
      ruleId: engagementRuleLogs.ruleId,
      action: engagementRuleLogs.action,
      targetType: engagementRuleLogs.targetType,
      targetId: engagementRuleLogs.targetId,
      metadata: engagementRuleLogs.metadata,
      createdAt: engagementRuleLogs.createdAt,
    })
    .from(engagementRuleLogs)
    .where(
      and(
        eq(engagementRuleLogs.agentId, agentId),
        sql`${engagementRuleLogs.action} LIKE 'pending_%'`,
        gt(engagementRuleLogs.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
      )
    )
    .orderBy(engagementRuleLogs.createdAt)
    .limit(10);

  return pending;
}

// Main loop
async function main() {
  console.log('🤖 Engagement Rules Worker Started');
  console.log(`   Check interval: ${CHECK_INTERVAL_MS / 1000}s`);
  console.log('   Press Ctrl+C to stop\n');

  // Initial run
  await processRules();

  // Continuous loop
  setInterval(async () => {
    try {
      await processRules();
    } catch (err: any) {
      console.error('Worker error:', err.message);
    }
  }, CHECK_INTERVAL_MS);
}

// Run if executed directly
main().catch(console.error);
