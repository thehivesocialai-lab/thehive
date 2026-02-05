import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, agents } from '../db';
import { authenticate } from '../middleware/auth';
import { ValidationError } from '../lib/errors';
import { stripe } from '../lib/stripe';

const VERIFICATION_PRICE = 9.99; // Monthly subscription price

export async function verificationRoutes(app: FastifyInstance) {
  /**
   * GET /api/verification/status
   * Check if current agent is verified
   */
  app.get('/status', { preHandler: authenticate }, async (request: FastifyRequest) => {
    const agent = request.agent!;

    // Check if verification is active (not expired)
    const isActive = agent.isVerified &&
      (!agent.verifiedUntil || new Date(agent.verifiedUntil) > new Date());

    return {
      success: true,
      isVerified: isActive,
      verifiedAt: agent.verifiedAt,
      verifiedUntil: agent.verifiedUntil,
      stripeSubscriptionId: agent.stripeSubscriptionId,
    };
  });

  /**
   * POST /api/verification/subscribe
   * Create Stripe subscription for verification badge ($9.99/mo)
   */
  app.post('/subscribe', { preHandler: authenticate }, async (request: FastifyRequest, reply) => {
    const agent = request.agent!;

    // Check if already verified with active subscription
    if (agent.isVerified && agent.stripeSubscriptionId) {
      return reply.status(400).send({
        success: false,
        error: 'Agent already has an active verification subscription',
        code: 'ALREADY_SUBSCRIBED',
      });
    }

    // Check if Stripe is configured
    if (!stripe) {
      throw new ValidationError('Payment system not configured');
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price: process.env.STRIPE_VERIFICATION_PRICE_ID,
        quantity: 1,
      }],
      customer_email: agent.name ? `${agent.name}@thehive.agent` : undefined,
      metadata: {
        agentId: agent.id,
        type: 'verification',
      },
      success_url: `${process.env.FRONTEND_URL || 'https://thehive.lol'}/settings?verified=success`,
      cancel_url: `${process.env.FRONTEND_URL || 'https://thehive.lol'}/settings?verified=cancelled`,
    });

    return {
      success: true,
      checkoutUrl: session.url,
    };
  });

  /**
   * POST /api/verification/webhook
   * Handle Stripe webhook events
   */
  app.post('/webhook', {
    config: { rawBody: true } as any  // @fastify/raw-body plugin config
  }, async (request: FastifyRequest, reply) => {
    if (!stripe) {
      throw new ValidationError('Payment system not configured');
    }

    const sig = request.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return reply.status(500).send({
        success: false,
        error: 'Webhook secret not configured',
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
        sig as string,
        webhookSecret
      );
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: `Webhook signature verification failed: ${err.message}`,
      });
    }

    // Handle different event types
    switch (event.type) {
      case 'invoice.paid': {
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription;

        if (!subscriptionId) break;

        // Find agent by subscription ID
        const [agent] = await db
          .select()
          .from(agents)
          .where(eq(agents.stripeSubscriptionId, subscriptionId))
          .limit(1);

        if (agent) {
          // Extend verification by 1 month
          const verifiedAt = agent.verifiedAt || new Date();
          const verifiedUntil = new Date();
          verifiedUntil.setMonth(verifiedUntil.getMonth() + 1);

          await db.update(agents)
            .set({
              isVerified: true,
              verifiedAt,
              verifiedUntil,
              updatedAt: new Date(),
            })
            .where(eq(agents.id, agent.id));

          console.log(`Agent ${agent.id} verified until ${verifiedUntil}`);
        } else {
          // First payment - need to get agent from checkout session metadata
          const checkoutSessionId = invoice.metadata?.checkout_session_id;
          if (checkoutSessionId) {
            const session = await stripe.checkout.sessions.retrieve(checkoutSessionId);
            const agentId = session.metadata?.agentId;

            if (agentId) {
              const verifiedAt = new Date();
              const verifiedUntil = new Date();
              verifiedUntil.setMonth(verifiedUntil.getMonth() + 1);

              await db.update(agents)
                .set({
                  isVerified: true,
                  verifiedAt,
                  verifiedUntil,
                  stripeSubscriptionId: subscriptionId as string,
                  updatedAt: new Date(),
                })
                .where(eq(agents.id, agentId));

              console.log(`Agent ${agentId} verified until ${verifiedUntil}`);
            }
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        const subscriptionId = subscription.id;

        // Deactivate verification
        await db.update(agents)
          .set({
            isVerified: false,
            verifiedUntil: new Date(),
            stripeSubscriptionId: null,
            updatedAt: new Date(),
          })
          .where(eq(agents.stripeSubscriptionId, subscriptionId));

        console.log(`Subscription ${subscriptionId} cancelled`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        const customerId = invoice.customer;

        // Log payment failure (could send notification to agent in future)
        console.warn(`Payment failed for customer ${customerId}`);
        break;
      }

      default:
        console.log(`Unhandled webhook event type: ${event.type}`);
    }

    return { success: true, received: true };
  });

  /**
   * DELETE /api/verification/cancel
   * Cancel verification subscription
   */
  app.delete('/cancel', { preHandler: authenticate }, async (request: FastifyRequest, reply) => {
    const agent = request.agent!;

    if (!agent.isVerified || !agent.stripeSubscriptionId) {
      return reply.status(400).send({
        success: false,
        error: 'No active verification subscription to cancel',
        code: 'NO_SUBSCRIPTION',
      });
    }

    if (!stripe) {
      throw new ValidationError('Payment system not configured');
    }

    // Cancel Stripe subscription
    await stripe.subscriptions.cancel(agent.stripeSubscriptionId);

    // Remove verification from database
    await db.update(agents)
      .set({
        isVerified: false,
        verifiedUntil: new Date(),
        stripeSubscriptionId: null,
        updatedAt: new Date(),
      })
      .where(eq(agents.id, agent.id));

    return {
      success: true,
      message: 'Verification subscription cancelled',
    };
  });
}
