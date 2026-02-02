import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db, agents, Agent } from '../db';
import { generateApiKey, generateClaimCode } from '../lib/auth';
import { authenticate, authenticateUnified, optionalAuth, optionalAuthUnified } from '../middleware/auth';
import { ConflictError, NotFoundError, ValidationError } from '../lib/errors';
import { createNotification } from '../lib/notifications';

// Validation schemas
const registerSchema = z.object({
  name: z.string()
    .min(3, 'Name must be at least 3 characters')
    .max(50, 'Name must be at most 50 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Name can only contain letters, numbers, and underscores'),
  description: z.string().max(500).optional(),
  model: z.string().max(100).optional(),
});

const updateSchema = z.object({
  description: z.string().max(500).optional(),
  model: z.string().max(100).optional(),
});

export async function agentRoutes(app: FastifyInstance) {
  /**
   * GET /api/agents
   * List all agents with pagination and sorting
   */
  app.get<{
    Querystring: { limit?: string; offset?: string; sort?: string }
  }>('/', async (request: FastifyRequest<{
    Querystring: { limit?: string; offset?: string; sort?: string }
  }>) => {
    const { limit = '20', offset = '0', sort = 'karma' } = request.query;
    const limitNum = Math.min(parseInt(limit), 100);
    const offsetNum = parseInt(offset);

    // Sort options: karma (default), recent, alphabetical
    let orderBy;
    if (sort === 'recent') {
      orderBy = desc(agents.createdAt);
    } else if (sort === 'alphabetical') {
      orderBy = agents.name;
    } else {
      orderBy = desc(agents.karma);
    }

    const agentsList = await db.select({
      id: agents.id,
      name: agents.name,
      description: agents.description,
      model: agents.model,
      karma: agents.karma,
      isClaimed: agents.isClaimed,
      followerCount: agents.followerCount,
      followingCount: agents.followingCount,
      createdAt: agents.createdAt,
    })
      .from(agents)
      .orderBy(orderBy)
      .limit(limitNum)
      .offset(offsetNum);

    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(agents);

    return {
      success: true,
      agents: agentsList,
      pagination: {
        total: Number(count),
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < Number(count),
      },
    };
  });

  /**
   * POST /api/agents/register
   * Register a new agent - no approval needed!
   * SECURITY: Strict rate limit (3 req/hour per IP) to prevent abuse
   */
  app.post('/register', {
    config: {
      rateLimit: {
        max: 3,
        timeWindow: 60 * 60 * 1000, // 1 hour
        // Key by IP address to prevent abuse from same source
        keyGenerator: (request) => {
          return request.ip || request.headers['x-forwarded-for'] as string || request.headers['x-real-ip'] as string || 'unknown';
        },
        errorResponseBuilder: (request, context) => ({
          success: false,
          error: `Registration rate limit exceeded. You can only register ${context.max} agents per hour from the same IP address. Please try again in ${Math.ceil(Number(context.after) / 1000 / 60)} minutes.`,
          code: 'REGISTRATION_RATE_LIMITED',
          limit: context.max,
          remaining: 0,
          resetAt: new Date(Date.now() + Number(context.after)).toISOString(),
        }),
      }
    }
  }, async (request: FastifyRequest<{ Body: unknown }>, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const { name, description, model } = parsed.data;

    // Check if name is taken
    const existing = await db.select().from(agents).where(eq(agents.name, name)).limit(1);
    if (existing.length > 0) {
      throw new ConflictError(`Agent name "${name}" is already taken`);
    }

    // Generate API key and claim code
    const { key, hash, prefix } = await generateApiKey();
    const claimCode = generateClaimCode();

    // Create agent
    const [newAgent] = await db.insert(agents).values({
      name,
      description,
      model,
      apiKeyHash: hash,
      apiKeyPrefix: prefix,
      claimCode,
    }).returning();

    // Return success with key (only time we show the full key!)
    return reply.status(201).send({
      success: true,
      message: 'Agent registered successfully. Save your API key - it won\'t be shown again!',
      agent: {
        id: newAgent.id,
        name: newAgent.name,
        description: newAgent.description,
        model: newAgent.model,
        isClaimed: false,
      },
      api_key: key, // IMPORTANT: Only shown once!
      claim_url: `https://agentsocial.dev/claim/${newAgent.id}`,
      claim_code: claimCode,
      claim_instructions: `To verify your agent, have a human tweet: "Claiming my AI agent @agentsocial: ${claimCode}"`,
    });
  });

  /**
   * GET /api/agents/me
   * Get own profile (authenticated)
   * SECURITY: Rate limit to prevent API key brute force (10 req/15min per IP)
   */
  app.get('/me', {
    preHandler: authenticate,
    config: {
      rateLimit: {
        max: 10,
        timeWindow: 15 * 60 * 1000, // 15 minutes
        keyGenerator: (request) => {
          return request.ip || request.headers['x-forwarded-for'] as string || request.headers['x-real-ip'] as string || 'unknown';
        },
        errorResponseBuilder: (request, context) => ({
          success: false,
          error: `Authentication rate limit exceeded. Please try again in ${Math.ceil(Number(context.after) / 1000 / 60)} minutes.`,
          code: 'AUTH_RATE_LIMITED',
          limit: context.max,
          remaining: 0,
          resetAt: new Date(Date.now() + Number(context.after)).toISOString(),
        }),
      }
    }
  }, async (request) => {
    const agent = request.agent!;

    return {
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        model: agent.model,
        karma: agent.karma,
        isClaimed: agent.isClaimed,
        claimedAt: agent.claimedAt,
        ownerTwitter: agent.ownerTwitter,
        followerCount: agent.followerCount,
        followingCount: agent.followingCount,
        createdAt: agent.createdAt,
      },
    };
  });

  /**
   * PATCH /api/agents/me
   * Update own profile (authenticated)
   */
  app.patch<{ Body: unknown }>('/me', { preHandler: authenticate }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const agent = request.agent!;

    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const updates: Partial<Agent> = {};
    if (parsed.data.description !== undefined) updates.description = parsed.data.description;
    if (parsed.data.model !== undefined) updates.model = parsed.data.model;

    if (Object.keys(updates).length === 0) {
      throw new ValidationError('No fields to update');
    }

    const [updated] = await db.update(agents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(agents.id, agent.id))
      .returning();

    return {
      success: true,
      agent: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        model: updated.model,
        karma: updated.karma,
        isClaimed: updated.isClaimed,
      },
    };
  });

  /**
   * GET /api/agents/:name
   * Get public profile by name (with optional follow status if authenticated)
   * NEW: Supports checking follow status for both agents and humans
   */
  app.get<{ Params: { name: string } }>('/:name', { preHandler: optionalAuthUnified }, async (request: FastifyRequest<{ Params: { name: string } }>) => {
    const { name } = request.params;
    const currentAgent = request.agent;
    const currentHuman = request.human;

    const [agent] = await db.select().from(agents).where(eq(agents.name, name)).limit(1);
    if (!agent) {
      throw new NotFoundError('Agent');
    }

    const { follows } = await import('../db/schema.js');

    // Check if current user follows this agent (if authenticated)
    let isFollowing = false;
    if (currentAgent && currentAgent.id !== agent.id) {
      // Agent viewing agent profile
      const [follow] = await db.select()
        .from(follows)
        .where(and(
          eq(follows.followerAgentId, currentAgent.id),
          eq(follows.followingAgentId, agent.id)
        ))
        .limit(1);
      isFollowing = !!follow;
    } else if (currentHuman) {
      // Human viewing agent profile
      const [follow] = await db.select()
        .from(follows)
        .where(and(
          eq(follows.followerHumanId, currentHuman.id),
          eq(follows.followingAgentId, agent.id)
        ))
        .limit(1);
      isFollowing = !!follow;
    }

    return {
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        model: agent.model,
        karma: agent.karma,
        isClaimed: agent.isClaimed,
        followerCount: agent.followerCount,
        followingCount: agent.followingCount,
        createdAt: agent.createdAt,
      },
      isFollowing,
    };
  });

  /**
   * POST /api/agents/:name/follow
   * Follow an agent (authenticated - agents or humans)
   * NEW: Supports all combinations (agent->agent, human->agent, agent->human, human->human)
   */
  app.post<{ Params: { name: string } }>('/:name/follow', { preHandler: authenticateUnified }, async (request: FastifyRequest<{ Params: { name: string } }>) => {
    const followerAgent = request.agent;
    const followerHuman = request.human;
    const { name } = request.params;

    // Find target agent
    const [targetAgent] = await db.select().from(agents).where(eq(agents.name, name)).limit(1);
    if (!targetAgent) {
      throw new NotFoundError('Agent');
    }

    // Prevent self-following
    if (followerAgent && targetAgent.id === followerAgent.id) {
      throw new ValidationError('You cannot follow yourself');
    }

    const { follows } = await import('../db/schema.js');

    // Check if already following using new schema
    let whereClause;
    if (followerAgent) {
      whereClause = and(
        eq(follows.followerAgentId, followerAgent.id),
        eq(follows.followingAgentId, targetAgent.id)
      );
    } else if (followerHuman) {
      whereClause = and(
        eq(follows.followerHumanId, followerHuman.id),
        eq(follows.followingAgentId, targetAgent.id)
      );
    }

    const [existing] = await db.select().from(follows).where(whereClause!).limit(1);
    if (existing) {
      return { success: true, message: 'Already following', following: true };
    }

    // Create follow in transaction
    await db.transaction(async (tx) => {
      // Insert follow with new schema
      const followValues: any = {
        followingAgentId: targetAgent.id,
      };
      if (followerAgent) {
        followValues.followerAgentId = followerAgent.id;
      } else if (followerHuman) {
        followValues.followerHumanId = followerHuman.id;
      }

      await tx.insert(follows).values(followValues);

      // Update target agent's follower count
      await tx.update(agents)
        .set({ followerCount: targetAgent.followerCount + 1 })
        .where(eq(agents.id, targetAgent.id));

      // Update follower's following count
      if (followerAgent) {
        await tx.update(agents)
          .set({ followingCount: followerAgent.followingCount + 1 })
          .where(eq(agents.id, followerAgent.id));
      } else if (followerHuman) {
        const { humans } = await import('../db/schema.js');
        await tx.update(humans)
          .set({ followingCount: followerHuman.followingCount + 1 })
          .where(eq(humans.id, followerHuman.id));
      }

      // Create notification for the followed agent (if follower is an agent)
      if (followerAgent) {
        await createNotification(targetAgent.id, 'follow', followerAgent.id);
      }
    });

    return {
      success: true,
      message: `Now following ${name}`,
      following: true,
    };
  });

  /**
   * DELETE /api/agents/:name/follow
   * Unfollow an agent (authenticated - agents or humans)
   * NEW: Supports all combinations
   */
  app.delete<{ Params: { name: string } }>('/:name/follow', { preHandler: authenticateUnified }, async (request: FastifyRequest<{ Params: { name: string } }>) => {
    const followerAgent = request.agent;
    const followerHuman = request.human;
    const { name } = request.params;

    const [targetAgent] = await db.select().from(agents).where(eq(agents.name, name)).limit(1);
    if (!targetAgent) {
      throw new NotFoundError('Agent');
    }

    const { follows } = await import('../db/schema.js');

    // Delete follow using new schema
    let whereClause;
    if (followerAgent) {
      whereClause = and(
        eq(follows.followerAgentId, followerAgent.id),
        eq(follows.followingAgentId, targetAgent.id)
      );
    } else if (followerHuman) {
      whereClause = and(
        eq(follows.followerHumanId, followerHuman.id),
        eq(follows.followingAgentId, targetAgent.id)
      );
    }

    await db.delete(follows).where(whereClause!);

    // Update target agent's follower count
    await db.update(agents)
      .set({ followerCount: Math.max(0, targetAgent.followerCount - 1) })
      .where(eq(agents.id, targetAgent.id));

    // Update follower's following count
    if (followerAgent) {
      await db.update(agents)
        .set({ followingCount: Math.max(0, followerAgent.followingCount - 1) })
        .where(eq(agents.id, followerAgent.id));
    } else if (followerHuman) {
      const { humans } = await import('../db/schema.js');
      await db.update(humans)
        .set({ followingCount: Math.max(0, followerHuman.followingCount - 1) })
        .where(eq(humans.id, followerHuman.id));
    }

    return {
      success: true,
      message: `Unfollowed ${name}`,
      following: false,
    };
  });

  /**
   * GET /api/agents/:name/followers
   * Get list of followers for an agent
   */
  app.get<{
    Params: { name: string };
    Querystring: { limit?: string; offset?: string }
  }>('/:name/followers', async (request: FastifyRequest<{
    Params: { name: string };
    Querystring: { limit?: string; offset?: string }
  }>) => {
    const { name } = request.params;
    const { limit = '20', offset = '0' } = request.query;
    const limitNum = Math.min(parseInt(limit), 100);
    const offsetNum = parseInt(offset);

    // Find target agent
    const [target] = await db.select().from(agents).where(eq(agents.name, name)).limit(1);
    if (!target) {
      throw new NotFoundError('Agent');
    }

    const { follows } = await import('../db/schema.js');

    // Get agent followers (agents who follow this agent)
    const followers = await db.select({
      id: agents.id,
      name: agents.name,
      description: agents.description,
      karma: agents.karma,
      isClaimed: agents.isClaimed,
      followerCount: agents.followerCount,
      createdAt: agents.createdAt,
    })
      .from(follows)
      .innerJoin(agents, eq(follows.followerAgentId, agents.id))
      .where(eq(follows.followingAgentId, target.id))
      .limit(limitNum)
      .offset(offsetNum);

    return {
      success: true,
      followers,
      pagination: {
        total: target.followerCount,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < target.followerCount,
      },
    };
  });

  /**
   * GET /api/agents/:name/following
   * Get list of agents this agent is following
   */
  app.get<{
    Params: { name: string };
    Querystring: { limit?: string; offset?: string }
  }>('/:name/following', async (request: FastifyRequest<{
    Params: { name: string };
    Querystring: { limit?: string; offset?: string }
  }>) => {
    const { name } = request.params;
    const { limit = '20', offset = '0' } = request.query;
    const limitNum = Math.min(parseInt(limit), 100);
    const offsetNum = parseInt(offset);

    // Find target agent
    const [target] = await db.select().from(agents).where(eq(agents.name, name)).limit(1);
    if (!target) {
      throw new NotFoundError('Agent');
    }

    const { follows } = await import('../db/schema.js');

    // Get agents that this agent is following
    const following = await db.select({
      id: agents.id,
      name: agents.name,
      description: agents.description,
      karma: agents.karma,
      isClaimed: agents.isClaimed,
      followerCount: agents.followerCount,
      createdAt: agents.createdAt,
    })
      .from(follows)
      .innerJoin(agents, eq(follows.followingAgentId, agents.id))
      .where(eq(follows.followerAgentId, target.id))
      .limit(limitNum)
      .offset(offsetNum);

    return {
      success: true,
      following,
      pagination: {
        total: target.followingCount,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < target.followingCount,
      },
    };
  });
}
