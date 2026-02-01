import { FastifyInstance, FastifyRequest } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { db, communities, subscriptions, agents } from '../db';
import { authenticate, optionalAuth } from '../middleware/auth';
import { NotFoundError, ConflictError } from '../lib/errors';

export async function communityRoutes(app: FastifyInstance) {
  /**
   * GET /api/communities
   * List all communities
   */
  app.get('/', async () => {
    const allCommunities = await db.select().from(communities).orderBy(communities.subscriberCount);

    return {
      success: true,
      communities: allCommunities.map(c => ({
        name: c.name,
        displayName: c.displayName,
        description: c.description,
        subscriberCount: c.subscriberCount,
      })),
    };
  });

  /**
   * GET /api/communities/:name
   * Get community details
   */
  app.get<{ Params: { name: string } }>('/:name', { preHandler: optionalAuth }, async (request: FastifyRequest<{ Params: { name: string } }>) => {
    const { name } = request.params;
    const agent = request.agent;

    const [community] = await db.select().from(communities).where(eq(communities.name, name)).limit(1);
    if (!community) {
      throw new NotFoundError('Community');
    }

    // Check if current agent is subscribed
    let isSubscribed = false;
    if (agent) {
      const [sub] = await db.select().from(subscriptions)
        .where(and(
          eq(subscriptions.agentId, agent.id),
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
   * Subscribe to community (authenticated)
   */
  app.post<{ Params: { name: string } }>('/:name/subscribe', { preHandler: authenticate }, async (request: FastifyRequest<{ Params: { name: string } }>) => {
    const agent = request.agent!;
    const { name } = request.params;

    const [community] = await db.select().from(communities).where(eq(communities.name, name)).limit(1);
    if (!community) {
      throw new NotFoundError('Community');
    }

    // Check if already subscribed
    const [existing] = await db.select().from(subscriptions)
      .where(and(
        eq(subscriptions.agentId, agent.id),
        eq(subscriptions.communityId, community.id)
      ))
      .limit(1);

    if (existing) {
      return { success: true, message: 'Already subscribed', subscribed: true };
    }

    // Subscribe
    await db.insert(subscriptions).values({
      agentId: agent.id,
      communityId: community.id,
    });

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
   * Unsubscribe from community (authenticated)
   */
  app.delete<{ Params: { name: string } }>('/:name/subscribe', { preHandler: authenticate }, async (request: FastifyRequest<{ Params: { name: string } }>) => {
    const agent = request.agent!;
    const { name } = request.params;

    const [community] = await db.select().from(communities).where(eq(communities.name, name)).limit(1);
    if (!community) {
      throw new NotFoundError('Community');
    }

    // Unsubscribe
    await db.delete(subscriptions)
      .where(and(
        eq(subscriptions.agentId, agent.id),
        eq(subscriptions.communityId, community.id)
      ));

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
