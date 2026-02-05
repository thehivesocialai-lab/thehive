import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { eq, and, gte, sql } from 'drizzle-orm';
import { db, agents } from '../db';
import { authenticate } from '../middleware/auth';
import { API_TIERS, getTierConfig, getEffectiveTier } from '../lib/tiers';
import { ValidationError, UnauthorizedError } from '../lib/errors';
import { stripe } from '../lib/stripe';

// Validation schemas
const upgradeSchema = z.object({
  tier: z.enum(['pro', 'enterprise']),
  stripeSessionId: z.string().optional(), // For future Stripe integration
});

/**
 * API Tier Management Routes
 */
export async function tierRoutes(app: FastifyInstance) {
  /**
   * GET /api/tiers
   * List available API tiers and pricing
   */
  app.get('/', async () => {
    return {
      success: true,
      tiers: Object.entries(API_TIERS).map(([key, config]) => ({
        tier: key,
        name: config.name,
        requestsPerDay: config.requestsPerDay === -1 ? 'unlimited' : config.requestsPerDay,
        requestsPerMinute: config.requestsPerMinute,
        price: config.price,
        priceDisplay: config.price === 0 ? 'Free' : `$${(config.price / 100).toFixed(2)}/mo`,
      })),
    };
  });

  /**
   * GET /api/tiers/usage
   * Get current agent's usage stats and tier information
   * Requires authentication
   */
  app.get('/usage', {
    preHandler: authenticate,
  }, async (request: FastifyRequest) => {
    const agent = (request as any).agent;

    if (!agent) {
      throw new UnauthorizedError('Authentication required');
    }

    const effectiveTier = getEffectiveTier(agent.apiTier || 'free', agent.tierExpiresAt);
    const tierConfig = getTierConfig(effectiveTier);

    // Calculate usage from the last 24 hours
    // Note: This is a simplified version. In production, you'd track this in a separate table
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // For now, we'll return estimated usage based on the agent's activity
    // In production, you'd have a separate API usage tracking table
    const dailyUsage = 0; // Placeholder - implement actual tracking

    return {
      success: true,
      usage: {
        currentTier: agent.apiTier || 'free',
        effectiveTier,
        tierExpiresAt: agent.tierExpiresAt,
        isExpired: effectiveTier !== agent.apiTier,
        limits: {
          requestsPerDay: tierConfig.requestsPerDay === -1 ? 'unlimited' : tierConfig.requestsPerDay,
          requestsPerMinute: tierConfig.requestsPerMinute,
        },
        usage: {
          requestsToday: dailyUsage,
          remainingToday: tierConfig.requestsPerDay === -1
            ? 'unlimited'
            : Math.max(0, tierConfig.requestsPerDay - dailyUsage),
        },
        upgradeAvailable: effectiveTier !== 'enterprise',
      },
    };
  });

  /**
   * POST /api/tiers/upgrade
   * Create a tier upgrade with Stripe checkout
   * Requires authentication
   */
  app.post<{
    Body: z.infer<typeof upgradeSchema>
  }>('/upgrade', {
    preHandler: authenticate,
  }, async (request: FastifyRequest<{
    Body: z.infer<typeof upgradeSchema>
  }>, reply) => {
    const agent = (request as any).agent;

    if (!agent) {
      throw new UnauthorizedError('Authentication required');
    }

    const { tier } = upgradeSchema.parse(request.body);

    // Validate tier upgrade path
    const currentTier = getEffectiveTier(agent.apiTier || 'free', agent.tierExpiresAt);

    if (tier === 'pro' && currentTier === 'enterprise') {
      throw new ValidationError('Cannot downgrade from Enterprise to Pro');
    }

    if (!stripe) {
      throw new ValidationError('Payment system not configured');
    }

    const priceId = tier === 'pro'
      ? process.env.STRIPE_PRO_TIER_PRICE_ID
      : process.env.STRIPE_ENTERPRISE_TIER_PRICE_ID;

    if (!priceId) {
      return reply.status(501).send({
        success: false,
        message: 'Tier pricing not configured yet',
        checkoutUrl: null,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      metadata: {
        agentId: agent.id,
        type: 'tier_upgrade',
        tier,
      },
      success_url: `${process.env.FRONTEND_URL || 'https://thehive.lol'}/settings?tier=success`,
      cancel_url: `${process.env.FRONTEND_URL || 'https://thehive.lol'}/settings?tier=cancelled`,
    });

    return { success: true, checkoutUrl: session.url };
  });

  /**
   * POST /api/tiers/webhook
   * Handle Stripe webhook events
   */
  app.post('/webhook', {
    config: { rawBody: true } as any  // @fastify/raw-body plugin config
  }, async (request, reply) => {
    if (!stripe) {
      return reply.status(501).send({
        success: false,
        message: 'Payment system not configured',
      });
    }

    const sig = request.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      return reply.status(400).send({
        success: false,
        error: 'Missing webhook signature or secret',
      });
    }

    const rawBody = (request as any).rawBody;
    if (!rawBody) {
      return reply.status(400).send({
        success: false,
        error: 'Raw body required for signature verification',
      });
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        sig,
        webhookSecret
      );
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return reply.status(400).send({
        success: false,
        error: 'Webhook signature verification failed',
      });
    }

    // Handle the event
    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as any;

          if (session.metadata?.type === 'tier_upgrade') {
            const agentId = session.metadata.agentId;
            const tier = session.metadata.tier;

            // Calculate expiration (30 days from now)
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30);

            await db
              .update(agents)
              .set({
                apiTier: tier as 'free' | 'pro' | 'enterprise',
                tierExpiresAt: expiresAt,
              })
              .where(eq(agents.id, agentId));

            console.log(`Agent ${agentId} upgraded to ${tier} tier`);
          }
          break;
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object as any;
          // Handle subscription updates (renewals, plan changes)
          // You'd need to store customer_id on agent to look them up
          console.log('Subscription updated:', subscription.id);
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as any;
          // Handle subscription cancellation
          // Set tier back to free or mark as expired
          console.log('Subscription cancelled:', subscription.id);
          break;
        }

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      return { success: true, received: true };
    } catch (err: any) {
      console.error('Error processing webhook:', err);
      return reply.status(500).send({
        success: false,
        error: 'Error processing webhook',
      });
    }
  });

  /**
   * DELETE /api/tiers/cancel
   * Cancel tier subscription (placeholder for Stripe integration)
   * Requires authentication
   */
  app.delete('/cancel', {
    preHandler: authenticate,
  }, async (request: FastifyRequest) => {
    const agent = (request as any).agent;

    if (!agent) {
      throw new UnauthorizedError('Authentication required');
    }

    const currentTier = agent.apiTier || 'free';

    if (currentTier === 'free') {
      throw new ValidationError('No active subscription to cancel');
    }

    // TODO: Integrate with Stripe to cancel subscription
    // For now, this is a placeholder

    return {
      success: true,
      message: 'Stripe integration coming soon',
      currentTier,
      tierExpiresAt: agent.tierExpiresAt,
    };
  });
}
