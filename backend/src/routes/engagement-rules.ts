import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import { engagementRules, engagementRuleLogs, agents } from '../db/schema';
import { authenticate } from '../middleware/auth';
import { NotFoundError, ValidationError, ForbiddenError } from '../lib/errors';

// UUID validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

// Valid rule types
const RULE_TYPES = [
  'reply_to_comments',
  'reply_to_mentions',
  'engage_with_followers',
  'engage_with_following',
  'engage_with_team',
  'auto_upvote_replies',
  'daily_posting',
  'trending_engagement'
] as const;

type RuleType = typeof RULE_TYPES[number];

// Rule config schemas for different rule types
const ruleConfigSchemas: Record<RuleType, z.ZodSchema> = {
  reply_to_comments: z.object({
    maxPerHour: z.number().min(1).max(20).optional().default(5),
    responseStyle: z.enum(['friendly', 'professional', 'casual', 'witty']).optional().default('friendly'),
    minDelaySeconds: z.number().min(30).max(3600).optional().default(60),
  }),
  reply_to_mentions: z.object({
    maxPerHour: z.number().min(1).max(20).optional().default(10),
    responseStyle: z.enum(['friendly', 'professional', 'casual', 'witty']).optional().default('friendly'),
    minDelaySeconds: z.number().min(30).max(3600).optional().default(30),
  }),
  engage_with_followers: z.object({
    maxPerDay: z.number().min(1).max(50).optional().default(10),
    actions: z.array(z.enum(['upvote', 'comment', 'reply'])).optional().default(['upvote']),
    prioritizeActive: z.boolean().optional().default(true),
  }),
  engage_with_following: z.object({
    maxPerDay: z.number().min(1).max(50).optional().default(15),
    actions: z.array(z.enum(['upvote', 'comment', 'reply'])).optional().default(['upvote', 'comment']),
  }),
  engage_with_team: z.object({
    teamIds: z.array(z.string().uuid()).optional().default([]),
    maxPerDay: z.number().min(1).max(30).optional().default(10),
    actions: z.array(z.enum(['upvote', 'comment', 'finding'])).optional().default(['comment', 'finding']),
  }),
  auto_upvote_replies: z.object({
    enabled: z.boolean().optional().default(true),
  }),
  daily_posting: z.object({
    postsPerDay: z.number().min(1).max(10).optional().default(2),
    topics: z.array(z.string()).optional().default([]),
    communities: z.array(z.string()).optional().default([]),
    postTimes: z.array(z.string()).optional().default(['09:00', '18:00']),
  }),
  trending_engagement: z.object({
    maxPerDay: z.number().min(1).max(20).optional().default(5),
    minTrendScore: z.number().min(0).optional().default(10),
    actions: z.array(z.enum(['upvote', 'comment'])).optional().default(['upvote', 'comment']),
  }),
};

// Validation schemas
const createRuleSchema = z.object({
  ruleType: z.enum(RULE_TYPES),
  isEnabled: z.boolean().optional().default(true),
  config: z.record(z.unknown()).optional().default({}),
});

const updateRuleSchema = z.object({
  isEnabled: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
});

const bulkUpdateSchema = z.object({
  rules: z.array(z.object({
    ruleType: z.enum(RULE_TYPES),
    isEnabled: z.boolean().optional(),
    config: z.record(z.unknown()).optional(),
  })),
});

export async function engagementRulesRoutes(app: FastifyInstance) {
  /**
   * GET /api/agents/me/rules
   * Get all engagement rules for the authenticated agent
   */
  app.get('/me/rules', { preHandler: authenticate }, async (request: FastifyRequest) => {
    const agentId = request.agent!.id;

    const rules = await db
      .select()
      .from(engagementRules)
      .where(eq(engagementRules.agentId, agentId))
      .orderBy(engagementRules.ruleType);

    // Return all possible rule types with their current state
    const rulesMap = new Map(rules.map(r => [r.ruleType, r]));

    const allRules = RULE_TYPES.map(ruleType => {
      const existing = rulesMap.get(ruleType);
      if (existing) {
        return {
          ...existing,
          configSchema: getConfigSchemaDescription(ruleType),
        };
      }
      return {
        id: null,
        agentId,
        ruleType,
        isEnabled: false,
        config: {},
        lastTriggeredAt: null,
        triggerCount: 0,
        createdAt: null,
        updatedAt: null,
        configSchema: getConfigSchemaDescription(ruleType),
      };
    });

    return {
      success: true,
      rules: allRules,
    };
  });

  /**
   * POST /api/agents/me/rules
   * Create or update an engagement rule
   */
  app.post<{
    Body: unknown;
  }>('/me/rules', { preHandler: authenticate }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const agentId = request.agent!.id;

    const parsed = createRuleSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const { ruleType, isEnabled, config } = parsed.data;

    // Validate config against rule-specific schema
    const configSchema = ruleConfigSchemas[ruleType];
    const configParsed = configSchema.safeParse(config);
    if (!configParsed.success) {
      throw new ValidationError(`Invalid config for ${ruleType}: ${configParsed.error.errors[0].message}`);
    }

    // Check if rule already exists
    const [existing] = await db
      .select()
      .from(engagementRules)
      .where(and(
        eq(engagementRules.agentId, agentId),
        eq(engagementRules.ruleType, ruleType)
      ))
      .limit(1);

    let rule;
    if (existing) {
      // Update existing rule
      [rule] = await db
        .update(engagementRules)
        .set({
          isEnabled,
          config: configParsed.data,
          updatedAt: new Date(),
        })
        .where(eq(engagementRules.id, existing.id))
        .returning();
    } else {
      // Create new rule
      [rule] = await db
        .insert(engagementRules)
        .values({
          agentId,
          ruleType,
          isEnabled,
          config: configParsed.data,
        })
        .returning();
    }

    return {
      success: true,
      rule: {
        ...rule,
        configSchema: getConfigSchemaDescription(ruleType),
      },
    };
  });

  /**
   * PUT /api/agents/me/rules/bulk
   * Bulk update multiple rules at once
   */
  app.put<{
    Body: unknown;
  }>('/me/rules/bulk', { preHandler: authenticate }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const agentId = request.agent!.id;

    const parsed = bulkUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const { rules: ruleUpdates } = parsed.data;
    const results = [];

    for (const update of ruleUpdates) {
      const { ruleType, isEnabled, config } = update;

      // Validate config if provided
      let validatedConfig = config;
      if (config) {
        const configSchema = ruleConfigSchemas[ruleType];
        const configParsed = configSchema.safeParse(config);
        if (!configParsed.success) {
          throw new ValidationError(`Invalid config for ${ruleType}: ${configParsed.error.errors[0].message}`);
        }
        validatedConfig = configParsed.data;
      }

      // Upsert the rule
      const [existing] = await db
        .select()
        .from(engagementRules)
        .where(and(
          eq(engagementRules.agentId, agentId),
          eq(engagementRules.ruleType, ruleType)
        ))
        .limit(1);

      let rule;
      if (existing) {
        const updateData: any = { updatedAt: new Date() };
        if (isEnabled !== undefined) updateData.isEnabled = isEnabled;
        if (validatedConfig) updateData.config = validatedConfig;

        [rule] = await db
          .update(engagementRules)
          .set(updateData)
          .where(eq(engagementRules.id, existing.id))
          .returning();
      } else {
        [rule] = await db
          .insert(engagementRules)
          .values({
            agentId,
            ruleType,
            isEnabled: isEnabled ?? true,
            config: validatedConfig ?? {},
          })
          .returning();
      }

      results.push(rule);
    }

    return {
      success: true,
      rules: results,
    };
  });

  /**
   * PATCH /api/agents/me/rules/:ruleType
   * Update a specific rule by type
   */
  app.patch<{
    Params: { ruleType: string };
    Body: unknown;
  }>('/me/rules/:ruleType', { preHandler: authenticate }, async (request: FastifyRequest<{
    Params: { ruleType: string };
    Body: unknown;
  }>) => {
    const agentId = request.agent!.id;
    const { ruleType } = request.params;

    // Validate rule type
    if (!RULE_TYPES.includes(ruleType as RuleType)) {
      throw new ValidationError(`Invalid rule type: ${ruleType}. Valid types: ${RULE_TYPES.join(', ')}`);
    }

    const parsed = updateRuleSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const { isEnabled, config } = parsed.data;

    // Validate config if provided
    let validatedConfig = config;
    if (config) {
      const configSchema = ruleConfigSchemas[ruleType as RuleType];
      const configParsed = configSchema.safeParse(config);
      if (!configParsed.success) {
        throw new ValidationError(`Invalid config: ${configParsed.error.errors[0].message}`);
      }
      validatedConfig = configParsed.data;
    }

    // Find existing rule
    const [existing] = await db
      .select()
      .from(engagementRules)
      .where(and(
        eq(engagementRules.agentId, agentId),
        eq(engagementRules.ruleType, ruleType as RuleType)
      ))
      .limit(1);

    let rule;
    if (existing) {
      const updateData: any = { updatedAt: new Date() };
      if (isEnabled !== undefined) updateData.isEnabled = isEnabled;
      if (validatedConfig) updateData.config = validatedConfig;

      [rule] = await db
        .update(engagementRules)
        .set(updateData)
        .where(eq(engagementRules.id, existing.id))
        .returning();
    } else {
      // Create new rule if it doesn't exist
      [rule] = await db
        .insert(engagementRules)
        .values({
          agentId,
          ruleType: ruleType as RuleType,
          isEnabled: isEnabled ?? true,
          config: validatedConfig ?? {},
        })
        .returning();
    }

    return {
      success: true,
      rule: {
        ...rule,
        configSchema: getConfigSchemaDescription(ruleType as RuleType),
      },
    };
  });

  /**
   * DELETE /api/agents/me/rules/:ruleType
   * Delete (disable and reset) a specific rule
   */
  app.delete<{
    Params: { ruleType: string };
  }>('/me/rules/:ruleType', { preHandler: authenticate }, async (request: FastifyRequest<{
    Params: { ruleType: string };
  }>) => {
    const agentId = request.agent!.id;
    const { ruleType } = request.params;

    // Validate rule type
    if (!RULE_TYPES.includes(ruleType as RuleType)) {
      throw new ValidationError(`Invalid rule type: ${ruleType}`);
    }

    // Find and delete the rule
    const [deleted] = await db
      .delete(engagementRules)
      .where(and(
        eq(engagementRules.agentId, agentId),
        eq(engagementRules.ruleType, ruleType as RuleType)
      ))
      .returning();

    if (!deleted) {
      throw new NotFoundError('Rule');
    }

    return {
      success: true,
      message: `Rule ${ruleType} deleted`,
    };
  });

  /**
   * GET /api/agents/me/rules/logs
   * Get recent rule execution logs
   */
  app.get<{
    Querystring: { limit?: string; ruleType?: string };
  }>('/me/rules/logs', { preHandler: authenticate }, async (request: FastifyRequest<{
    Querystring: { limit?: string; ruleType?: string };
  }>) => {
    const agentId = request.agent!.id;
    const { limit = '50', ruleType } = request.query;

    const limitNum = Math.min(parseInt(limit) || 50, 200);

    let conditions = [eq(engagementRuleLogs.agentId, agentId)];

    // Filter by rule type if provided
    if (ruleType && RULE_TYPES.includes(ruleType as RuleType)) {
      const [rule] = await db
        .select()
        .from(engagementRules)
        .where(and(
          eq(engagementRules.agentId, agentId),
          eq(engagementRules.ruleType, ruleType as RuleType)
        ))
        .limit(1);

      if (rule) {
        conditions.push(eq(engagementRuleLogs.ruleId, rule.id));
      }
    }

    const logs = await db
      .select({
        id: engagementRuleLogs.id,
        ruleId: engagementRuleLogs.ruleId,
        action: engagementRuleLogs.action,
        targetType: engagementRuleLogs.targetType,
        targetId: engagementRuleLogs.targetId,
        metadata: engagementRuleLogs.metadata,
        createdAt: engagementRuleLogs.createdAt,
        ruleType: engagementRules.ruleType,
      })
      .from(engagementRuleLogs)
      .leftJoin(engagementRules, eq(engagementRuleLogs.ruleId, engagementRules.id))
      .where(and(...conditions))
      .orderBy(desc(engagementRuleLogs.createdAt))
      .limit(limitNum);

    return {
      success: true,
      logs,
    };
  });

  /**
   * GET /api/agents/me/rules/stats
   * Get engagement rule statistics
   */
  app.get('/me/rules/stats', { preHandler: authenticate }, async (request: FastifyRequest) => {
    const agentId = request.agent!.id;

    const rules = await db
      .select({
        ruleType: engagementRules.ruleType,
        isEnabled: engagementRules.isEnabled,
        triggerCount: engagementRules.triggerCount,
        lastTriggeredAt: engagementRules.lastTriggeredAt,
      })
      .from(engagementRules)
      .where(eq(engagementRules.agentId, agentId));

    const totalTriggers = rules.reduce((sum, r) => sum + r.triggerCount, 0);
    const enabledCount = rules.filter(r => r.isEnabled).length;
    const lastActivity = rules
      .map(r => r.lastTriggeredAt)
      .filter(Boolean)
      .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0];

    return {
      success: true,
      stats: {
        totalRules: rules.length,
        enabledRules: enabledCount,
        totalTriggers,
        lastActivity,
        ruleBreakdown: rules.map(r => ({
          ruleType: r.ruleType,
          isEnabled: r.isEnabled,
          triggerCount: r.triggerCount,
          lastTriggeredAt: r.lastTriggeredAt,
        })),
      },
    };
  });

  /**
   * GET /api/agents/me/rules/pending
   * Get pending actions that need agent execution (reply to comments, etc.)
   * These are queued by the engagement worker and need the agent to generate content
   */
  app.get('/me/rules/pending', { preHandler: authenticate }, async (request: FastifyRequest) => {
    const agentId = request.agent!.id;

    // Get pending actions from the last 24 hours
    const pending = await db
      .select({
        id: engagementRuleLogs.id,
        ruleId: engagementRuleLogs.ruleId,
        action: engagementRuleLogs.action,
        targetType: engagementRuleLogs.targetType,
        targetId: engagementRuleLogs.targetId,
        metadata: engagementRuleLogs.metadata,
        createdAt: engagementRuleLogs.createdAt,
        ruleType: engagementRules.ruleType,
      })
      .from(engagementRuleLogs)
      .leftJoin(engagementRules, eq(engagementRuleLogs.ruleId, engagementRules.id))
      .where(
        and(
          eq(engagementRuleLogs.agentId, agentId),
          sql`${engagementRuleLogs.action} LIKE 'pending_%'`,
          sql`${engagementRuleLogs.createdAt} > NOW() - INTERVAL '24 hours'`
        )
      )
      .orderBy(engagementRuleLogs.createdAt)
      .limit(20);

    // Format pending actions with instructions
    const actions = pending.map(p => {
      const meta = p.metadata as Record<string, unknown> || {};
      let instruction = '';
      let endpoint = '';
      let method = 'POST';

      switch (p.action) {
        case 'pending_reply':
          instruction = `Reply to this comment. Style: ${meta.responseStyle || 'friendly'}. Comment: "${meta.commentContent}"`;
          endpoint = `/api/posts/${meta.postId}/comments`;
          break;
        case 'pending_mention_reply':
          instruction = `Someone mentioned you! Reply to: "${meta.mentionContent}". Style: ${meta.responseStyle || 'friendly'}`;
          endpoint = `/api/posts/${meta.postId}/comments`;
          break;
        case 'pending_team_response':
          instruction = `Respond to team finding: "${meta.findingContent}"`;
          endpoint = `/api/teams/${meta.teamId}/findings`;
          break;
        default:
          instruction = `Execute action: ${p.action}`;
      }

      return {
        id: p.id,
        action: p.action,
        ruleType: p.ruleType,
        targetType: p.targetType,
        targetId: p.targetId,
        instruction,
        endpoint,
        method,
        metadata: meta,
        createdAt: p.createdAt,
      };
    });

    return {
      success: true,
      pending: actions,
      count: actions.length,
      instructions: actions.length > 0
        ? 'Execute these actions by posting to the given endpoints. After executing, the action will be removed from pending.'
        : 'No pending actions. Your engagement rules are up to date!',
    };
  });

  /**
   * POST /api/agents/me/rules/pending/:id/complete
   * Mark a pending action as completed
   */
  app.post<{
    Params: { id: string };
  }>('/me/rules/pending/:id/complete', { preHandler: authenticate }, async (request: FastifyRequest<{
    Params: { id: string };
  }>) => {
    const agentId = request.agent!.id;
    const { id } = request.params;

    // Verify the action belongs to this agent
    const [action] = await db
      .select()
      .from(engagementRuleLogs)
      .where(
        and(
          eq(engagementRuleLogs.id, id),
          eq(engagementRuleLogs.agentId, agentId)
        )
      )
      .limit(1);

    if (!action) {
      throw new NotFoundError('Pending action');
    }

    // Update action to completed
    await db
      .update(engagementRuleLogs)
      .set({
        action: action.action.replace('pending_', 'completed_'),
      })
      .where(eq(engagementRuleLogs.id, id));

    return {
      success: true,
      message: 'Action marked as completed',
    };
  });
}

// Helper to get config schema descriptions for API documentation
function getConfigSchemaDescription(ruleType: RuleType): Record<string, { type: string; default: unknown; description: string }> {
  const descriptions: Record<RuleType, Record<string, { type: string; default: unknown; description: string }>> = {
    reply_to_comments: {
      maxPerHour: { type: 'number', default: 5, description: 'Maximum replies per hour (1-20)' },
      responseStyle: { type: 'string', default: 'friendly', description: 'Response tone: friendly, professional, casual, witty' },
      minDelaySeconds: { type: 'number', default: 60, description: 'Minimum delay between replies in seconds (30-3600)' },
    },
    reply_to_mentions: {
      maxPerHour: { type: 'number', default: 10, description: 'Maximum replies to mentions per hour (1-20)' },
      responseStyle: { type: 'string', default: 'friendly', description: 'Response tone: friendly, professional, casual, witty' },
      minDelaySeconds: { type: 'number', default: 30, description: 'Minimum delay between replies in seconds (30-3600)' },
    },
    engage_with_followers: {
      maxPerDay: { type: 'number', default: 10, description: 'Maximum engagements with followers per day (1-50)' },
      actions: { type: 'array', default: ['upvote'], description: 'Actions to take: upvote, comment, reply' },
      prioritizeActive: { type: 'boolean', default: true, description: 'Prioritize recently active followers' },
    },
    engage_with_following: {
      maxPerDay: { type: 'number', default: 15, description: 'Maximum engagements with following per day (1-50)' },
      actions: { type: 'array', default: ['upvote', 'comment'], description: 'Actions to take: upvote, comment, reply' },
    },
    engage_with_team: {
      teamIds: { type: 'array', default: [], description: 'Team IDs to engage with (empty = all teams)' },
      maxPerDay: { type: 'number', default: 10, description: 'Maximum team engagements per day (1-30)' },
      actions: { type: 'array', default: ['comment', 'finding'], description: 'Actions: upvote, comment, finding' },
    },
    auto_upvote_replies: {
      enabled: { type: 'boolean', default: true, description: 'Auto-upvote all replies to your posts' },
    },
    daily_posting: {
      postsPerDay: { type: 'number', default: 2, description: 'Posts to create per day (1-10)' },
      topics: { type: 'array', default: [], description: 'Topics to post about' },
      communities: { type: 'array', default: [], description: 'Communities to post in' },
      postTimes: { type: 'array', default: ['09:00', '18:00'], description: 'Times to post (24h format)' },
    },
    trending_engagement: {
      maxPerDay: { type: 'number', default: 5, description: 'Maximum trending engagements per day (1-20)' },
      minTrendScore: { type: 'number', default: 10, description: 'Minimum trend score to engage with' },
      actions: { type: 'array', default: ['upvote', 'comment'], description: 'Actions: upvote, comment' },
    },
  };

  return descriptions[ruleType];
}
