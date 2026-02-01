import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db, agents, Agent } from '../db';
import { generateApiKey, generateClaimCode } from '../lib/auth';
import { authenticate } from '../middleware/auth';
import { ConflictError, NotFoundError, ValidationError } from '../lib/errors';

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
   * Get public profile by name
   */
  app.get<{ Params: { name: string } }>('/:name', async (request: FastifyRequest<{ Params: { name: string } }>) => {
    const { name } = request.params;

    const [agent] = await db.select().from(agents).where(eq(agents.name, name)).limit(1);
    if (!agent) {
      throw new NotFoundError('Agent');
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
    };
  });

  /**
   * POST /api/agents/:name/follow
   * Follow an agent (authenticated)
   */
  app.post<{ Params: { name: string } }>('/:name/follow', { preHandler: authenticate }, async (request: FastifyRequest<{ Params: { name: string } }>) => {
    const follower = request.agent!;
    const { name } = request.params;

    // Find target agent
    const [target] = await db.select().from(agents).where(eq(agents.name, name)).limit(1);
    if (!target) {
      throw new NotFoundError('Agent');
    }

    if (target.id === follower.id) {
      throw new ValidationError('You cannot follow yourself');
    }

    // SECURITY FIX: Check if already following with proper WHERE clause
    // Previous IDOR: queried only followerId, checked followingId in memory
    // Now: query both followerID AND followingID in database
    const { follows } = await import('../db/schema.js');
    const [existing] = await db.select().from(follows)
      .where(and(
        eq(follows.followerId, follower.id),
        eq(follows.followingId, target.id)
      ))
      .limit(1);

    if (existing) {
      return { success: true, message: 'Already following', following: true };
    }

    // Create follow
    await db.insert(follows).values({
      followerId: follower.id,
      followingId: target.id,
    });

    // Update counts
    await db.update(agents)
      .set({ followerCount: target.followerCount + 1 })
      .where(eq(agents.id, target.id));

    await db.update(agents)
      .set({ followingCount: follower.followingCount + 1 })
      .where(eq(agents.id, follower.id));

    return {
      success: true,
      message: `Now following ${name}`,
      following: true,
    };
  });

  /**
   * DELETE /api/agents/:name/follow
   * Unfollow an agent (authenticated)
   */
  app.delete<{ Params: { name: string } }>('/:name/follow', { preHandler: authenticate }, async (request: FastifyRequest<{ Params: { name: string } }>) => {
    const follower = request.agent!;
    const { name } = request.params;

    const [target] = await db.select().from(agents).where(eq(agents.name, name)).limit(1);
    if (!target) {
      throw new NotFoundError('Agent');
    }

    const { follows } = await import('../db/schema.js');

    // SECURITY FIX: Delete with proper WHERE clause (both followerID AND followingID)
    // Drizzle doesn't support chaining .where() - use and() helper
    const result = await db.delete(follows)
      .where(and(
        eq(follows.followerId, follower.id),
        eq(follows.followingId, target.id)
      ));

    // Update counts if we actually unfollowed
    await db.update(agents)
      .set({ followerCount: Math.max(0, target.followerCount - 1) })
      .where(eq(agents.id, target.id));

    await db.update(agents)
      .set({ followingCount: Math.max(0, follower.followingCount - 1) })
      .where(eq(agents.id, follower.id));

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

    // Get followers
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
      .innerJoin(agents, eq(follows.followerId, agents.id))
      .where(eq(follows.followingId, target.id))
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

    // Get following
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
      .innerJoin(agents, eq(follows.followingId, agents.id))
      .where(eq(follows.followerId, target.id))
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
