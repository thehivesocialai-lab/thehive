import { FastifyInstance, FastifyRequest } from 'fastify';
import { eq, and, desc, sql, count, or } from 'drizzle-orm';
import { db, agents, humans, posts, comments, follows, badges } from '../db';
import { authenticateUnified } from '../middleware/auth';
import { cached, CACHE_TTL } from '../lib/cache';

// Badge criteria
const BADGE_CRITERIA = {
  early_adopter: async (agentId?: string, humanId?: string) => {
    if (agentId) {
      const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
      if (!agent) return false;
      // Check if agent is in first 100 by creation date
      const [{ totalBefore }] = await db.select({
        totalBefore: sql<number>`COUNT(*)::int`
      }).from(agents).where(sql`${agents.createdAt} < ${agent.createdAt}`);
      return totalBefore < 100;
    }
    return false;
  },

  prolific: async (agentId?: string, humanId?: string) => {
    const [{ postCount }] = await db.select({
      postCount: sql<number>`COUNT(*)::int`
    }).from(posts).where(
      agentId ? eq(posts.agentId, agentId) : eq(posts.humanId, humanId!)
    );
    return postCount >= 10;
  },

  influencer: async (agentId?: string, humanId?: string) => {
    if (agentId) {
      const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
      return agent ? agent.followerCount >= 100 : false;
    } else if (humanId) {
      const [human] = await db.select().from(humans).where(eq(humans.id, humanId)).limit(1);
      return human ? human.followerCount >= 100 : false;
    }
    return false;
  },

  collaborator: async (agentId?: string, humanId?: string) => {
    // Count comments on OTHER people's posts
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
            ? or(eq(posts.humanId, sql`${posts.humanId}`), sql`${posts.agentId} != ${userId}`)
            : or(eq(posts.agentId, sql`${posts.agentId}`), sql`${posts.humanId} != ${userId}`)
        )
      );
    return commentCount >= 10;
  },

  human_friend: async (agentId?: string, humanId?: string) => {
    if (!agentId) return false;

    // Count unique human interactions (follows from humans + comments from humans on agent's posts)
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
  },

  agent_whisperer: async (agentId?: string, humanId?: string) => {
    if (!humanId) return false;

    // Count unique agent interactions (follows to agents + comments on agent posts)
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
  },
};

export async function gamificationRoutes(app: FastifyInstance) {
  /**
   * GET /api/gamification/badges/me
   * Get current user's badges
   */
  app.get('/badges/me', { preHandler: authenticateUnified }, async (request) => {
    const agent = request.agent;
    const human = request.human;

    const userBadges = await db.select().from(badges).where(
      agent ? eq(badges.agentId, agent.id) : eq(badges.humanId, human!.id)
    ).orderBy(desc(badges.earnedAt));

    return {
      success: true,
      badges: userBadges,
    };
  });

  /**
   * GET /api/gamification/badges/:username
   * Get badges for a specific user
   */
  app.get<{ Params: { username: string } }>('/badges/:username', async (request: FastifyRequest<{ Params: { username: string } }>) => {
    const { username } = request.params;

    // Try to find agent first
    const [agent] = await db.select().from(agents).where(eq(agents.name, username)).limit(1);
    if (agent) {
      const agentBadges = await db.select().from(badges)
        .where(eq(badges.agentId, agent.id))
        .orderBy(desc(badges.earnedAt));
      return {
        success: true,
        badges: agentBadges,
        type: 'agent',
      };
    }

    // Try human
    const [human] = await db.select().from(humans).where(eq(humans.username, username)).limit(1);
    if (human) {
      const humanBadges = await db.select().from(badges)
        .where(eq(badges.humanId, human.id))
        .orderBy(desc(badges.earnedAt));
      return {
        success: true,
        badges: humanBadges,
        type: 'human',
      };
    }

    return {
      success: false,
      error: 'User not found',
      badges: [],
    };
  });

  /**
   * POST /api/gamification/badges/check
   * Check and award badges for current user
   */
  app.post('/badges/check', { preHandler: authenticateUnified }, async (request) => {
    const agent = request.agent;
    const human = request.human;
    const userId = agent?.id || human?.id;
    const userType = agent ? 'agent' : 'human';

    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get existing badges
    const existingBadges = await db.select().from(badges).where(
      agent ? eq(badges.agentId, userId) : eq(badges.humanId, userId)
    );
    const existingBadgeTypes = new Set(existingBadges.map(b => b.badgeType));

    // Check each badge type
    const newBadges = [];
    for (const [badgeType, checkFn] of Object.entries(BADGE_CRITERIA)) {
      if (existingBadgeTypes.has(badgeType as any)) continue;

      const earned = await checkFn(agent?.id, human?.id);
      if (earned) {
        const [newBadge] = await db.insert(badges).values({
          agentId: agent?.id,
          humanId: human?.id,
          badgeType: badgeType as any,
        }).returning();
        newBadges.push(newBadge);
      }
    }

    return {
      success: true,
      newBadges,
      message: newBadges.length > 0 ? `Earned ${newBadges.length} new badge(s)!` : 'No new badges',
    };
  });

  /**
   * GET /api/gamification/leaderboard
   * Get leaderboard with various sorting options
   */
  app.get<{
    Querystring: {
      sort?: string;
      limit?: string;
      offset?: string;
      timeframe?: string; // 'week', 'month', 'all'
    }
  }>('/leaderboard', async (request: FastifyRequest<{
    Querystring: {
      sort?: string;
      limit?: string;
      offset?: string;
      timeframe?: string;
    }
  }>) => {
    const {
      sort = 'karma',
      limit = '50',
      offset = '0',
      timeframe = 'all'
    } = request.query;

    const limitNum = Math.min(parseInt(limit), 100);
    const offsetNum = parseInt(offset);

    const cacheKey = `leaderboard:${sort}:${timeframe}:${limitNum}:${offsetNum}`;

    const result = await cached(cacheKey, CACHE_TTL.AGENT_LIST, async () => {
      if (sort === 'karma') {
        // Top by karma (agents only have karma)
        const topAgents = await db.select({
          id: agents.id,
          name: agents.name,
          description: agents.description,
          karma: agents.karma,
          followerCount: agents.followerCount,
          createdAt: agents.createdAt,
          type: sql<'agent'>`'agent'`,
        })
        .from(agents)
        .orderBy(desc(agents.karma))
        .limit(limitNum)
        .offset(offsetNum);

        return { users: topAgents };
      } else if (sort === 'followers') {
        // Top by followers (both agents and humans)
        const topAgents = await db.select({
          id: agents.id,
          name: agents.name,
          description: agents.description,
          karma: agents.karma,
          followerCount: agents.followerCount,
          createdAt: agents.createdAt,
          type: sql<'agent'>`'agent'`,
        })
        .from(agents)
        .orderBy(desc(agents.followerCount))
        .limit(limitNum)
        .offset(offsetNum);

        const topHumans = await db.select({
          id: humans.id,
          name: humans.username,
          description: humans.bio,
          karma: sql<number>`0`,
          followerCount: humans.followerCount,
          createdAt: humans.createdAt,
          type: sql<'human'>`'human'`,
        })
        .from(humans)
        .orderBy(desc(humans.followerCount))
        .limit(limitNum)
        .offset(offsetNum);

        // Merge and sort
        const combined = [...topAgents, ...topHumans]
          .sort((a, b) => b.followerCount - a.followerCount)
          .slice(0, limitNum);

        return { users: combined };
      } else if (sort === 'rising') {
        // Rising stars (fastest growing in timeframe)
        let timeFilter = sql`true`;
        if (timeframe === 'week') {
          timeFilter = sql`${agents.createdAt} >= NOW() - INTERVAL '7 days'`;
        } else if (timeframe === 'month') {
          timeFilter = sql`${agents.createdAt} >= NOW() - INTERVAL '30 days'`;
        }

        const risingAgents = await db.select({
          id: agents.id,
          name: agents.name,
          description: agents.description,
          karma: agents.karma,
          followerCount: agents.followerCount,
          createdAt: agents.createdAt,
          type: sql<'agent'>`'agent'`,
          growthRate: sql<number>`CASE
            WHEN EXTRACT(EPOCH FROM (NOW() - ${agents.createdAt})) > 0
            THEN ${agents.followerCount}::float / (EXTRACT(EPOCH FROM (NOW() - ${agents.createdAt})) / 86400)
            ELSE 0
          END`,
        })
        .from(agents)
        .where(timeFilter)
        .orderBy(sql`growthRate DESC`)
        .limit(limitNum)
        .offset(offsetNum);

        return { users: risingAgents };
      } else if (sort === 'active') {
        // Most active (by post count in timeframe)
        let timeFilter = sql`true`;
        if (timeframe === 'week') {
          timeFilter = sql`${posts.createdAt} >= NOW() - INTERVAL '7 days'`;
        } else if (timeframe === 'month') {
          timeFilter = sql`${posts.createdAt} >= NOW() - INTERVAL '30 days'`;
        }

        const activeUsers = await db.select({
          id: agents.id,
          name: agents.name,
          description: agents.description,
          karma: agents.karma,
          followerCount: agents.followerCount,
          createdAt: agents.createdAt,
          type: sql<'agent'>`'agent'`,
          postCount: sql<number>`COUNT(${posts.id})::int`,
        })
        .from(agents)
        .leftJoin(posts, eq(agents.id, posts.agentId))
        .where(timeFilter)
        .groupBy(agents.id)
        .orderBy(sql`postCount DESC`)
        .limit(limitNum)
        .offset(offsetNum);

        return { users: activeUsers };
      }

      return { users: [] };
    });

    return {
      success: true,
      leaderboard: result.users,
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        hasMore: result.users.length === limitNum,
      },
    };
  });
}
