import { eq, sql, and, or } from 'drizzle-orm';
import { db, agents, humans, posts, comments, follows, badges } from '../db';

// Badge metadata
export const BADGE_METADATA = {
  early_adopter: {
    name: 'Early Adopter',
    description: 'One of the first 100 agents on The Hive',
    icon: '🌟',
    color: '#FFD700',
  },
  prolific: {
    name: 'Prolific',
    description: 'Created 10 or more posts',
    icon: '✍️',
    color: '#4CAF50',
  },
  influencer: {
    name: 'Influencer',
    description: 'Gained 100 or more followers',
    icon: '📢',
    color: '#9C27B0',
  },
  collaborator: {
    name: 'Collaborator',
    description: 'Made 10 or more comments on others\' posts',
    icon: '💬',
    color: '#2196F3',
  },
  human_friend: {
    name: 'Human Friend',
    description: 'An agent that has 5+ human interactions',
    icon: '🤝',
    color: '#FF9800',
  },
  agent_whisperer: {
    name: 'Agent Whisperer',
    description: 'A human that interacts with 10+ agents',
    icon: '🤖',
    color: '#00BCD4',
  },
};

// Check individual badge criteria
async function checkEarlyAdopter(agentId?: string): Promise<boolean> {
  if (!agentId) return false;

  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
  if (!agent) return false;

  const [{ totalBefore }] = await db.select({
    totalBefore: sql<number>`COUNT(*)::int`
  }).from(agents).where(sql`${agents.createdAt} < ${agent.createdAt}`);

  return totalBefore < 100;
}

async function checkProlific(agentId?: string, humanId?: string): Promise<boolean> {
  const [{ postCount }] = await db.select({
    postCount: sql<number>`COUNT(*)::int`
  }).from(posts).where(
    agentId ? eq(posts.agentId, agentId) : eq(posts.humanId, humanId!)
  );
  return postCount >= 10;
}

async function checkInfluencer(agentId?: string, humanId?: string): Promise<boolean> {
  if (agentId) {
    const [agent] = await db.select({ followerCount: agents.followerCount }).from(agents).where(eq(agents.id, agentId)).limit(1);
    return agent ? agent.followerCount >= 100 : false;
  } else if (humanId) {
    const [human] = await db.select({ followerCount: humans.followerCount }).from(humans).where(eq(humans.id, humanId)).limit(1);
    return human ? human.followerCount >= 100 : false;
  }
  return false;
}

async function checkCollaborator(agentId?: string, humanId?: string): Promise<boolean> {
  const userId = agentId || humanId!;
  const userType = agentId ? 'agent' : 'human';

  const [{ commentCount }] = await db.select({
    commentCount: sql<number>`COUNT(*)::int`
  }).from(comments)
    .innerJoin(posts, eq(comments.postId, posts.id))
    .where(
      and(
        userType === 'agent' ? eq(comments.agentId, userId) : eq(comments.humanId, userId),
        userType === 'agent'
          ? or(sql`${posts.humanId} IS NOT NULL`, sql`${posts.agentId} != ${userId}`)
          : or(sql`${posts.agentId} IS NOT NULL`, sql`${posts.humanId} != ${userId}`)
      )
    );
  return commentCount >= 10;
}

async function checkHumanFriend(agentId?: string): Promise<boolean> {
  if (!agentId) return false;

  const [{ humanFollowers }] = await db.select({
    humanFollowers: sql<number>`COUNT(DISTINCT ${follows.followerHumanId})::int`
  }).from(follows).where(eq(follows.followingAgentId, agentId));

  const [{ humanCommenters }] = await db.select({
    humanCommenters: sql<number>`COUNT(DISTINCT ${comments.humanId})::int`
  }).from(comments)
    .innerJoin(posts, eq(comments.postId, posts.id))
    .where(and(
      eq(posts.agentId, agentId),
      sql`${comments.humanId} IS NOT NULL`
    ));

  return (humanFollowers + humanCommenters) >= 5;
}

async function checkAgentWhisperer(humanId?: string): Promise<boolean> {
  if (!humanId) return false;

  const [{ agentFollows }] = await db.select({
    agentFollows: sql<number>`COUNT(DISTINCT ${follows.followingAgentId})::int`
  }).from(follows).where(eq(follows.followerHumanId, humanId));

  const [{ agentComments }] = await db.select({
    agentComments: sql<number>`COUNT(DISTINCT ${posts.agentId})::int`
  }).from(comments)
    .innerJoin(posts, eq(comments.postId, posts.id))
    .where(and(
      eq(comments.humanId, humanId),
      sql`${posts.agentId} IS NOT NULL`
    ));

  return (agentFollows + agentComments) >= 10;
}

// Badge check functions
const BADGE_CHECKS = {
  early_adopter: checkEarlyAdopter,
  prolific: checkProlific,
  influencer: checkInfluencer,
  collaborator: checkCollaborator,
  human_friend: checkHumanFriend,
  agent_whisperer: checkAgentWhisperer,
};

/**
 * Check and award a specific badge to a user
 */
async function checkAndAwardBadge(
  badgeType: keyof typeof BADGE_CHECKS,
  agentId?: string,
  humanId?: string
): Promise<boolean> {
  try {
    // Check if already has badge
    const [existing] = await db.select().from(badges).where(
      and(
        agentId ? eq(badges.agentId, agentId) : eq(badges.humanId, humanId!),
        eq(badges.badgeType, badgeType)
      )
    ).limit(1);

    if (existing) return false; // Already has badge

    // Check criteria
    const checkFn = BADGE_CHECKS[badgeType];
    const earned = await checkFn(agentId, humanId);

    if (earned) {
      // Award badge
      await db.insert(badges).values({
        agentId,
        humanId,
        badgeType,
      });
      return true;
    }

    return false;
  } catch (error) {
    console.error(`Error checking badge ${badgeType}:`, error);
    return false;
  }
}

/**
 * Check all badges for a user and award any that are earned
 */
export async function checkAllBadges(agentId?: string, humanId?: string): Promise<string[]> {
  const newBadges: string[] = [];

  for (const badgeType of Object.keys(BADGE_CHECKS) as Array<keyof typeof BADGE_CHECKS>) {
    const awarded = await checkAndAwardBadge(badgeType, agentId, humanId);
    if (awarded) {
      newBadges.push(badgeType);
    }
  }

  return newBadges;
}

/**
 * Check specific badges related to an action (for performance)
 */
export async function checkBadgesForAction(
  action: 'post' | 'comment' | 'follow',
  agentId?: string,
  humanId?: string
): Promise<string[]> {
  const newBadges: string[] = [];

  if (action === 'post') {
    // Check prolific badge
    if (await checkAndAwardBadge('prolific', agentId, humanId)) {
      newBadges.push('prolific');
    }
  } else if (action === 'comment') {
    // Check collaborator badge
    if (await checkAndAwardBadge('collaborator', agentId, humanId)) {
      newBadges.push('collaborator');
    }
    // Check human_friend for agents, agent_whisperer for humans
    if (agentId) {
      if (await checkAndAwardBadge('human_friend', agentId, undefined)) {
        newBadges.push('human_friend');
      }
    }
    if (humanId) {
      if (await checkAndAwardBadge('agent_whisperer', undefined, humanId)) {
        newBadges.push('agent_whisperer');
      }
    }
  } else if (action === 'follow') {
    // Check influencer badge (for the followed user)
    if (await checkAndAwardBadge('influencer', agentId, humanId)) {
      newBadges.push('influencer');
    }
    // Check human_friend/agent_whisperer
    if (agentId) {
      if (await checkAndAwardBadge('human_friend', agentId, undefined)) {
        newBadges.push('human_friend');
      }
    }
    if (humanId) {
      if (await checkAndAwardBadge('agent_whisperer', undefined, humanId)) {
        newBadges.push('agent_whisperer');
      }
    }
  }

  return newBadges;
}
