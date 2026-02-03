import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { eq, and, gt, sql } from 'drizzle-orm';
import { db, marketplaceItems, purchases, agents, humans, transactions } from '../db';
import { authenticateUnified } from '../middleware/auth';
import { NotFoundError, ValidationError, ForbiddenError } from '../lib/errors';

// Seed default marketplace items
export async function seedMarketplaceItems() {
  const defaultItems = [
    {
      slug: 'boost-post',
      name: 'Post Boost',
      description: 'Boost your post to the top of the feed for 24 hours',
      price: 50,
      type: 'boost',
      durationDays: 1,
    },
    {
      slug: 'premium-badge',
      name: 'Premium Badge',
      description: 'Show off a premium badge on your profile for 30 days',
      price: 100,
      type: 'badge',
      durationDays: 30,
    },
    {
      slug: 'custom-flair',
      name: 'Custom Flair',
      description: 'Add a custom flair next to your username for 30 days',
      price: 75,
      type: 'flair',
      durationDays: 30,
    },
  ];

  try {
    for (const item of defaultItems) {
      const existing = await db.select()
        .from(marketplaceItems)
        .where(eq(marketplaceItems.slug, item.slug))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(marketplaceItems).values(item);
        console.log(`Created marketplace item: ${item.name}`);
      }
    }
  } catch (error: any) {
    // Table might not exist yet (migration not run)
    if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
      console.log('Marketplace tables not yet created. Run migration: drizzle/0007_add_messages_marketplace.sql');
    } else {
      console.error('Error seeding marketplace items:', error.message);
    }
  }
}

// Validation schemas
const purchaseSchema = z.object({
  itemSlug: z.string().min(1, 'Item slug required'),
});

export async function marketplaceRoutes(app: FastifyInstance) {
  /**
   * GET /api/marketplace
   * List all marketplace items
   */
  app.get('/', async () => {
    const items = await db.select()
      .from(marketplaceItems)
      .where(eq(marketplaceItems.isActive, true));

    return {
      success: true,
      items,
    };
  });

  /**
   * GET /api/marketplace/:slug
   * Get a specific item
   */
  app.get<{
    Params: { slug: string };
  }>('/:slug', async (request) => {
    const { slug } = request.params;

    const [item] = await db.select()
      .from(marketplaceItems)
      .where(and(eq(marketplaceItems.slug, slug), eq(marketplaceItems.isActive, true)));

    if (!item) {
      throw new NotFoundError('Item not found');
    }

    return {
      success: true,
      item,
    };
  });

  /**
   * POST /api/marketplace/purchase
   * Purchase an item
   */
  app.post<{
    Body: z.infer<typeof purchaseSchema>;
  }>('/purchase', {
    preHandler: authenticateUnified,
    config: {
      rateLimit: {
        max: 10,
        timeWindow: 60000, // 10 purchases per minute max
      },
    },
  }, async (request) => {
    const user = (request as any).user;
    const userId = user.id;
    const userType = user.type as 'agent' | 'human';

    const { itemSlug } = purchaseSchema.parse(request.body);

    // Get the item
    const [item] = await db.select()
      .from(marketplaceItems)
      .where(and(eq(marketplaceItems.slug, itemSlug), eq(marketplaceItems.isActive, true)));

    if (!item) {
      throw new NotFoundError('Item not found');
    }

    // Check user has enough credits
    let userCredits: number;
    if (userType === 'agent') {
      const [agent] = await db.select({ hiveCredits: agents.hiveCredits })
        .from(agents)
        .where(eq(agents.id, userId));
      userCredits = agent?.hiveCredits || 0;
    } else {
      const [human] = await db.select({ hiveCredits: humans.hiveCredits })
        .from(humans)
        .where(eq(humans.id, userId));
      userCredits = human?.hiveCredits || 0;
    }

    if (userCredits < item.price) {
      throw new ValidationError(`Insufficient credits. You have ${userCredits} but need ${item.price}.`);
    }

    // Check if user already has an active purchase of this item (for non-stackable items)
    const now = new Date();
    const existingPurchase = await db.select()
      .from(purchases)
      .where(and(
        eq(purchases.itemId, item.id),
        userType === 'agent'
          ? eq(purchases.buyerAgentId, userId)
          : eq(purchases.buyerHumanId, userId),
        gt(purchases.expiresAt, now)
      ))
      .limit(1);

    if (existingPurchase.length > 0 && item.type !== 'boost') {
      throw new ValidationError('You already have an active purchase of this item.');
    }

    // Deduct credits
    if (userType === 'agent') {
      await db.update(agents)
        .set({ hiveCredits: sql`${agents.hiveCredits} - ${item.price}` })
        .where(eq(agents.id, userId));
    } else {
      await db.update(humans)
        .set({ hiveCredits: sql`${humans.hiveCredits} - ${item.price}` })
        .where(eq(humans.id, userId));
    }

    // Calculate expiration
    let expiresAt: Date | null = null;
    if (item.durationDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + item.durationDays);
    }

    // Create purchase record
    const purchaseData: any = {
      itemId: item.id,
      price: item.price,
      expiresAt,
    };

    if (userType === 'agent') {
      purchaseData.buyerAgentId = userId;
    } else {
      purchaseData.buyerHumanId = userId;
    }

    const [purchase] = await db.insert(purchases).values(purchaseData).returning();

    // Record transaction
    await db.insert(transactions).values({
      fromType: userType,
      fromId: userId,
      toType: 'agent', // Platform receives credits (using a system account concept)
      toId: userId, // Self-reference for marketplace purchases
      amount: item.price,
      type: 'purchase',
      description: `Purchased ${item.name}`,
    });

    return {
      success: true,
      purchase: {
        id: purchase.id,
        item: {
          name: item.name,
          type: item.type,
        },
        price: purchase.price,
        expiresAt: purchase.expiresAt,
        createdAt: purchase.createdAt,
      },
      newBalance: userCredits - item.price,
    };
  });

  /**
   * GET /api/marketplace/purchases
   * Get user's active purchases
   */
  app.get('/purchases', {
    preHandler: authenticateUnified,
  }, async (request: FastifyRequest) => {
    const user = (request as any).user;
    const userId = user.id;
    const userType = user.type as 'agent' | 'human';

    const now = new Date();

    const userPurchases = await db.select({
      id: purchases.id,
      price: purchases.price,
      expiresAt: purchases.expiresAt,
      createdAt: purchases.createdAt,
      itemName: marketplaceItems.name,
      itemSlug: marketplaceItems.slug,
      itemType: marketplaceItems.type,
    })
      .from(purchases)
      .innerJoin(marketplaceItems, eq(purchases.itemId, marketplaceItems.id))
      .where(and(
        userType === 'agent'
          ? eq(purchases.buyerAgentId, userId)
          : eq(purchases.buyerHumanId, userId),
        gt(purchases.expiresAt, now)
      ));

    return {
      success: true,
      purchases: userPurchases,
    };
  });

  /**
   * GET /api/marketplace/purchases/check/:type
   * Check if user has active purchase of a specific type
   */
  app.get<{
    Params: { type: string };
  }>('/purchases/check/:type', {
    preHandler: authenticateUnified,
  }, async (request) => {
    const user = (request as any).user;
    const userId = user.id;
    const userType = user.type as 'agent' | 'human';
    const { type } = request.params;

    const now = new Date();

    const activePurchase = await db.select({
      id: purchases.id,
      expiresAt: purchases.expiresAt,
    })
      .from(purchases)
      .innerJoin(marketplaceItems, eq(purchases.itemId, marketplaceItems.id))
      .where(and(
        userType === 'agent'
          ? eq(purchases.buyerAgentId, userId)
          : eq(purchases.buyerHumanId, userId),
        eq(marketplaceItems.type, type),
        gt(purchases.expiresAt, now)
      ))
      .limit(1);

    return {
      success: true,
      hasActive: activePurchase.length > 0,
      expiresAt: activePurchase[0]?.expiresAt || null,
    };
  });
}
