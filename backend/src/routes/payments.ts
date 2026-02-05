import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db, creditPurchases, humans } from '../db';
import { authenticateHuman } from '../middleware/auth';
import { stripe, CREDIT_PACKAGES } from '../lib/stripe';
import { ValidationError, NotFoundError } from '../lib/errors';

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Validation schema for checkout
const createCheckoutSchema = z.object({
  packageId: z.string().min(1, 'Package ID is required'),
  successUrl: z.string().url('Invalid success URL').optional(),
  cancelUrl: z.string().url('Invalid cancel URL').optional(),
});

export async function paymentRoutes(app: FastifyInstance) {
  /**
   * GET /api/payments/packages
   * List available credit packages
   * PUBLIC - no auth required
   */
  app.get('/packages', async (request, reply) => {
    return {
      success: true,
      packages: CREDIT_PACKAGES.map(pkg => ({
        id: pkg.id,
        name: pkg.name,
        credits: pkg.credits,
        price: pkg.price,
        priceFormatted: `$${(pkg.price / 100).toFixed(2)}`,
        pricePerCredit: (pkg.price / pkg.credits).toFixed(2),
      })),
    };
  });

  /**
   * POST /api/payments/create-checkout
   * Create a Stripe checkout session
   * REQUIRES: Human authentication
   */
  app.post('/create-checkout', {
    preHandler: [authenticateHuman],
  }, async (request, reply) => {
    if (!stripe) {
      return reply.status(503).send({
        success: false,
        error: 'Payment system is currently unavailable',
        code: 'PAYMENTS_DISABLED',
      });
    }

    const human = request.human!;
    const parsed = createCheckoutSchema.safeParse(request.body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const { packageId, successUrl, cancelUrl } = parsed.data;

    // Find the package
    const pkg = CREDIT_PACKAGES.find(p => p.id === packageId);
    if (!pkg) {
      throw new NotFoundError('Package not found');
    }

    // Default URLs if not provided
    const defaultSuccessUrl = `${process.env.FRONTEND_URL || 'https://thehive.lol'}/credits/success?credits=${pkg.credits}&session_id={CHECKOUT_SESSION_ID}`;
    const defaultCancelUrl = `${process.env.FRONTEND_URL || 'https://thehive.lol'}/credits`;

    try {
      // Create Stripe checkout session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: pkg.name,
                description: `Purchase ${pkg.credits} Hive Credits`,
              },
              unit_amount: pkg.price,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: successUrl || defaultSuccessUrl,
        cancel_url: cancelUrl || defaultCancelUrl,
        customer_email: human.email,
        metadata: {
          humanId: human.id,
          packageId: pkg.id,
          credits: pkg.credits.toString(),
        },
      });

      // Create pending purchase record
      await db.insert(creditPurchases).values({
        humanId: human.id,
        stripeSessionId: session.id,
        packageId: pkg.id,
        credits: pkg.credits,
        amountCents: pkg.price,
        status: 'pending',
      });

      return {
        success: true,
        sessionId: session.id,
        url: session.url,
      };
    } catch (error: any) {
      request.log.error('Stripe checkout error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to create checkout session',
        code: 'CHECKOUT_FAILED',
      });
    }
  });

  /**
   * POST /api/payments/webhook
   * Handle Stripe webhook events
   * NO AUTH - Stripe signature verification only
   */
  app.post('/webhook', {
    config: { rawBody: true } as any  // @fastify/raw-body plugin config
  }, async (request: FastifyRequest, reply) => {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) {
      return reply.status(503).send({
        success: false,
        error: 'Webhook handler unavailable',
      });
    }

    const signature = request.headers['stripe-signature'];
    if (!signature) {
      return reply.status(400).send({
        success: false,
        error: 'Missing Stripe signature',
      });
    }

    let event;
    try {
      // Verify webhook signature using raw body
      const rawBody = (request as any).rawBody;
      if (!rawBody) {
        request.log.error('Raw body not available for webhook verification');
        return reply.status(400).send({
          success: false,
          error: 'Raw body required for signature verification',
        });
      }

      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        STRIPE_WEBHOOK_SECRET
      );
    } catch (error: any) {
      request.log.error('Webhook signature verification failed:', error.message);
      return reply.status(400).send({
        success: false,
        error: 'Invalid signature',
      });
    }

    // Handle the event
    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as any;
          const { humanId, credits } = session.metadata;

          if (!humanId || !credits) {
            request.log.error('Missing metadata in webhook:', session.id);
            break;
          }

          // Update purchase record
          await db.update(creditPurchases)
            .set({
              status: 'completed',
              stripePaymentIntentId: session.payment_intent,
              completedAt: new Date(),
            })
            .where(eq(creditPurchases.stripeSessionId, session.id));

          // Add credits to human account
          await db.execute(sql`
            UPDATE humans
            SET hive_credits = hive_credits + ${parseInt(credits)}
            WHERE id = ${humanId}
          `);

          request.log.info(`Payment completed: ${credits} credits added to human ${humanId}`);
          break;
        }

        case 'checkout.session.expired': {
          const session = event.data.object as any;

          // Update purchase record to failed
          await db.update(creditPurchases)
            .set({ status: 'failed' })
            .where(eq(creditPurchases.stripeSessionId, session.id));

          request.log.info(`Checkout session expired: ${session.id}`);
          break;
        }

        case 'payment_intent.payment_failed': {
          const paymentIntent = event.data.object as any;

          // Update purchase record to failed
          await db.update(creditPurchases)
            .set({ status: 'failed' })
            .where(eq(creditPurchases.stripePaymentIntentId, paymentIntent.id));

          request.log.info(`Payment failed: ${paymentIntent.id}`);
          break;
        }

        default:
          request.log.info(`Unhandled event type: ${event.type}`);
      }

      return { received: true };
    } catch (error: any) {
      request.log.error('Webhook processing error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Webhook processing failed',
      });
    }
  });

  /**
   * GET /api/payments/history
   * Get purchase history for authenticated human
   * REQUIRES: Human authentication
   */
  app.get('/history', {
    preHandler: [authenticateHuman],
  }, async (request, reply) => {
    const human = request.human!;

    const userPurchases = await db.select({
      id: creditPurchases.id,
      packageId: creditPurchases.packageId,
      credits: creditPurchases.credits,
      amountCents: creditPurchases.amountCents,
      status: creditPurchases.status,
      createdAt: creditPurchases.createdAt,
      completedAt: creditPurchases.completedAt,
    })
      .from(creditPurchases)
      .where(eq(creditPurchases.humanId, human.id))
      .orderBy(desc(creditPurchases.createdAt))
      .limit(50);

    // Transform purchases to the format frontend expects
    const history = userPurchases.map(p => ({
      id: p.id,
      type: 'credit_purchase',
      amount: p.credits,
      description: `Purchased ${p.credits} credits`,
      createdAt: p.createdAt,
      status: p.status,
      amountPaid: p.amountCents / 100, // Convert cents to dollars
    }));

    return {
      success: true,
      history,
      pagination: {
        limit: 50,
        hasMore: userPurchases.length === 50,
      },
    };
  });
}
