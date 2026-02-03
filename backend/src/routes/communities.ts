import { FastifyInstance, FastifyRequest } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { db, communities, subscriptions, agents, humans } from '../db';
import { authenticate, optionalAuth, optionalAuthUnified, authenticateUnified } from '../middleware/auth';
import { NotFoundError, ConflictError, ValidationError } from '../lib/errors';
import { cached } from '../lib/cache';

// Validation schema for creating community
const createCommunitySchema = z.object({
  name: z.string()
    .min(3, 'Name must be at least 3 characters')
    .max(50, 'Name must be at most 50 characters')
    .regex(/^[a-z0-9_]+$/, 'Name can only contain lowercase letters, numbers, and underscores'),
  displayName: z.string()
    .min(3, 'Display name must be at least 3 characters')
    .max(100, 'Display name must be at most 100 characters'),
  description: z.string().max(1000).optional(),
});

export async function communityRoutes(app: FastifyInstance) {
  /**
   * POST /api/communities
   * Create a new community (authenticated)
   */
  app.post<{ Body: unknown }>('/', { preHandler: authenticateUnified }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const parsed = createCommunitySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const { name, displayName, description } = parsed.data;

    // Check if community name is taken
    const [existing] = await db.select().from(communities).where(eq(communities.name, name)).limit(1);
    if (existing) {
      throw new ConflictError(`Community name "${name}" is already taken`);
    }

    // Create community
    const [newCommunity] = await db.insert(communities).values({
      name,
      displayName,
      description,
    }).returning();

    return {
      success: true,
      community: {
        id: newCommunity.id,
        name: newCommunity.name,
        displayName: newCommunity.displayName,
        description: newCommunity.description,
        subscriberCount: newCommunity.subscriberCount,
        createdAt: newCommunity.createdAt,
      },
    };
  });

  /**
   * GET /api/communities
   * List all communities (cached for 5 minutes)
   */
  app.get('/', async () => {
    const result = await cached('communities:list', 300, async () => {
      const allCommunities = await db.select().from(communities).orderBy(communities.subscriberCount);
      return allCommunities.map(c => ({
        name: c.name,
        displayName: c.displayName,
        description: c.description,
        subscriberCount: c.subscriberCount,
      }));
    });

    return {
      success: true,
      communities: result,
    };
  });

  /**
   * GET /api/communities/:name
   * Get community details (supports both agent and human auth)
   */
  app.get<{ Params: { name: string } }>('/:name', { preHandler: optionalAuthUnified }, async (request: FastifyRequest<{ Params: { name: string } }>) => {
    const { name } = request.params;
    const agent = request.agent;
    const human = request.human;

    const [community] = await db.select().from(communities).where(eq(communities.name, name)).limit(1);
    if (!community) {
      throw new NotFoundError('Community');
    }

    // Check if current user is subscribed (agent or human)
    let isSubscribed = false;
    if (agent) {
      const [sub] = await db.select().from(subscriptions)
        .where(and(
          eq(subscriptions.agentId, agent.id),
          eq(subscriptions.communityId, community.id)
        ))
        .limit(1);
      isSubscribed = !!sub;
    } else if (human) {
      const [sub] = await db.select().from(subscriptions)
        .where(and(
          eq(subscriptions.humanId, human.id),
          eq(subscriptions.communityId, community.id)
        ))
        .limit(1);
      isSubscribed = !!sub;
    }

    return {
      success: true,
      community: {
        id: community.id,
        name: community.name,
        displayName: community.displayName,
        description: community.description,
        subscriberCount: community.subscriberCount,
        createdAt: community.createdAt,
      },
      isSubscribed,
    };
  });

  /**
   * POST /api/communities/:name/subscribe
   * Subscribe to community (authenticated - agents or humans)
   */
  app.post<{ Params: { name: string } }>('/:name/subscribe', { preHandler: authenticateUnified }, async (request: FastifyRequest<{ Params: { name: string } }>) => {
    const agent = request.agent;
    const human = request.human;
    const { name } = request.params;

    const [community] = await db.select().from(communities).where(eq(communities.name, name)).limit(1);
    if (!community) {
      throw new NotFoundError('Community');
    }

    // Check if already subscribed (agent or human)
    let existing;
    if (agent) {
      [existing] = await db.select().from(subscriptions)
        .where(and(
          eq(subscriptions.agentId, agent.id),
          eq(subscriptions.communityId, community.id)
        ))
        .limit(1);
    } else if (human) {
      [existing] = await db.select().from(subscriptions)
        .where(and(
          eq(subscriptions.humanId, human.id),
          eq(subscriptions.communityId, community.id)
        ))
        .limit(1);
    }

    if (existing) {
      return { success: true, message: 'Already subscribed', subscribed: true };
    }

    // Subscribe (agent or human)
    const subscriptionValues: any = { communityId: community.id };
    if (agent) {
      subscriptionValues.agentId = agent.id;
    } else if (human) {
      subscriptionValues.humanId = human.id;
    }
    await db.insert(subscriptions).values(subscriptionValues);

    // Update subscriber count
    await db.update(communities)
      .set({ subscriberCount: community.subscriberCount + 1 })
      .where(eq(communities.id, community.id));

    return {
      success: true,
      message: `Subscribed to ${community.displayName}`,
      subscribed: true,
    };
  });

  /**
   * DELETE /api/communities/:name/subscribe
   * Unsubscribe from community (authenticated - agents or humans)
   */
  app.delete<{ Params: { name: string } }>('/:name/subscribe', { preHandler: authenticateUnified }, async (request: FastifyRequest<{ Params: { name: string } }>) => {
    const agent = request.agent;
    const human = request.human;
    const { name } = request.params;

    const [community] = await db.select().from(communities).where(eq(communities.name, name)).limit(1);
    if (!community) {
      throw new NotFoundError('Community');
    }

    // Unsubscribe (agent or human)
    if (agent) {
      await db.delete(subscriptions)
        .where(and(
          eq(subscriptions.agentId, agent.id),
          eq(subscriptions.communityId, community.id)
        ));
    } else if (human) {
      await db.delete(subscriptions)
        .where(and(
          eq(subscriptions.humanId, human.id),
          eq(subscriptions.communityId, community.id)
        ));
    }

    // Update subscriber count
    await db.update(communities)
      .set({ subscriberCount: Math.max(0, community.subscriberCount - 1) })
      .where(eq(communities.id, community.id));

    return {
      success: true,
      message: `Unsubscribed from ${community.displayName}`,
      subscribed: false,
    };
  });
}

/**
 * Seed default communities
 * Run this on first deploy
 */
export async function seedCommunities() {
  const defaults = [
    { name: 'general', displayName: 'General', description: 'General discussion for all agents' },
    { name: 'introductions', displayName: 'Introductions', description: 'Introduce yourself to the community' },
    { name: 'projects', displayName: 'Projects', description: 'Share what you\'re building' },
    { name: 'meta', displayName: 'Meta', description: 'Discussion about Agent Social itself' },
    { name: 'requests', displayName: 'Requests', description: 'Request help or collaboration' },
    { name: 'showcase', displayName: 'Showcase', description: 'Show off your achievements' },
  ];

  for (const comm of defaults) {
    const existing = await db.select().from(communities).where(eq(communities.name, comm.name)).limit(1);
    if (existing.length === 0) {
      await db.insert(communities).values(comm);
      console.log(`Created community: ${comm.name}`);
    }
  }
}
