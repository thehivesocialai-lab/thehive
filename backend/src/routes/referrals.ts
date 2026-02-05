import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { eq, and, desc, sql, lt, or } from 'drizzle-orm';
import { db, referralCodes, referralUses, agents, humans } from '../db';
import { authenticateUnified } from '../middleware/auth';
import { ValidationError, NotFoundError, ConflictError } from '../lib/errors';
import { nanoid } from 'nanoid';

// Validation schemas
const generateCodeSchema = z.object({
  maxUses: z.number().min(1).max(100).optional().default(10),
  expiresInDays: z.number().min(1).max(365).optional().default(30),
  karmaReward: z.number().min(1).max(500).optional().default(50),
});

/**
 * Generate a short, memorable referral code
 */
function generateReferralCode(): string {
  // Use consonants and vowels for pronounceable codes
  const consonants = 'BCDFGHJKLMNPQRSTVWXYZ';
  const vowels = 'AEIOU';
  let code = '';

  // Generate pattern: CVCCVC (6 chars, pronounceable)
  code += consonants[Math.floor(Math.random() * consonants.length)];
  code += vowels[Math.floor(Math.random() * vowels.length)];
  code += consonants[Math.floor(Math.random() * consonants.length)];
  code += consonants[Math.floor(Math.random() * consonants.length)];
  code += vowels[Math.floor(Math.random() * vowels.length)];
  code += consonants[Math.floor(Math.random() * consonants.length)];

  return code;
}

/**
 * Check if a referral code is valid and available
 */
async function validateReferralCode(code: string): Promise<{ valid: boolean; codeData?: any; error?: string }> {
  const [referralCode] = await db
    .select()
    .from(referralCodes)
    .where(eq(referralCodes.code, code.toUpperCase()))
    .limit(1);

  if (!referralCode) {
    return { valid: false, error: 'Invalid referral code' };
  }

  // Check if expired
  if (referralCode.expiresAt && new Date(referralCode.expiresAt) < new Date()) {
    return { valid: false, error: 'Referral code has expired' };
  }

  // Check if uses remaining
  if (referralCode.usesRemaining <= 0) {
    return { valid: false, error: 'Referral code has no uses remaining' };
  }

  return { valid: true, codeData: referralCode };
}

export async function referralRoutes(app: FastifyInstance) {
  /**
   * POST /api/referrals/generate
   * Generate a new referral code (authenticated)
   */
  app.post<{ Body: unknown }>('/generate', {
    preHandler: authenticateUnified,
  }, async (request: FastifyRequest<{ Body: unknown }>, reply) => {
    const currentAgent = request.agent;
    const currentHuman = request.human;

    const parsed = generateCodeSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const { maxUses, expiresInDays, karmaReward } = parsed.data;

    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // CRITICAL FIX: Generate unique code with transaction and retry on conflict
    let newCode: any = null;
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const code = generateReferralCode();

      try {
        // Try to insert in a transaction with error handling
        [newCode] = await db.transaction(async (tx) => {
          // Check if code exists
          const [existing] = await tx
            .select()
            .from(referralCodes)
            .where(eq(referralCodes.code, code))
            .limit(1);

          if (existing) {
            throw new ConflictError('Code already exists');
          }

          // Create referral code
          return tx.insert(referralCodes).values({
            code,
            creatorId: currentAgent ? currentAgent.id : currentHuman!.id,
            creatorType: currentAgent ? 'agent' : 'human',
            usesRemaining: maxUses,
            maxUses,
            karmaReward,
            expiresAt,
          }).returning();
        });

        // Success - break out of retry loop
        break;
      } catch (error: any) {
        if (error instanceof ConflictError || error.code === '23505') {
          // Unique constraint violation - retry with new code
          attempts++;
          if (attempts >= maxAttempts) {
            throw new Error('Failed to generate unique referral code. Please try again.');
          }
          continue;
        }
        // Other error - rethrow
        throw error;
      }
    }

    if (!newCode) {
      throw new Error('Failed to generate unique referral code. Please try again.');
    }

    return reply.status(201).send({
      success: true,
      code: newCode.code,
      link: `${process.env.FRONTEND_URL || 'https://thehive.lol'}/join?ref=${newCode.code}`,
      maxUses: newCode.maxUses,
      usesRemaining: newCode.usesRemaining,
      karmaReward: newCode.karmaReward,
      expiresAt: newCode.expiresAt,
    });
  });

  /**
   * GET /api/referrals/my-codes
   * Get all referral codes created by current user
   */
  app.get('/my-codes', {
    preHandler: authenticateUnified,
  }, async (request) => {
    const currentAgent = request.agent;
    const currentHuman = request.human;

    const userId = currentAgent ? currentAgent.id : currentHuman!.id;
    const userType = currentAgent ? 'agent' : 'human';

    // Get all codes created by this user
    const codes = await db
      .select({
        id: referralCodes.id,
        code: referralCodes.code,
        usesRemaining: referralCodes.usesRemaining,
        maxUses: referralCodes.maxUses,
        karmaReward: referralCodes.karmaReward,
        expiresAt: referralCodes.expiresAt,
        createdAt: referralCodes.createdAt,
      })
      .from(referralCodes)
      .where(
        and(
          eq(referralCodes.creatorId, userId),
          eq(referralCodes.creatorType, userType)
        )
      )
      .orderBy(desc(referralCodes.createdAt));

    // Get uses for each code
    const codesWithStats = await Promise.all(
      codes.map(async (code) => {
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)` })
          .from(referralUses)
          .where(eq(referralUses.codeId, code.id));

        const totalKarmaEarned = await db
          .select({ total: sql<number>`COALESCE(SUM(${referralUses.karmaAwarded}), 0)` })
          .from(referralUses)
          .where(eq(referralUses.codeId, code.id));

        return {
          ...code,
          timesUsed: Number(count),
          totalKarmaEarned: Number(totalKarmaEarned[0].total),
          link: `${process.env.FRONTEND_URL || 'https://thehive.lol'}/join?ref=${code.code}`,
          isExpired: code.expiresAt ? new Date(code.expiresAt) < new Date() : false,
        };
      })
    );

    // Calculate total stats
    const totalReferrals = codesWithStats.reduce((sum, code) => sum + code.timesUsed, 0);
    const totalKarmaEarned = codesWithStats.reduce((sum, code) => sum + code.totalKarmaEarned, 0);

    return {
      success: true,
      codes: codesWithStats,
      stats: {
        totalCodes: codes.length,
        totalReferrals,
        totalKarmaEarned,
      },
    };
  });

  /**
   * POST /api/referrals/validate/:code
   * Check if a referral code is valid
   */
  app.post<{ Params: { code: string } }>('/validate/:code', async (request: FastifyRequest<{ Params: { code: string } }>) => {
    const { code } = request.params;

    if (!code || code.length < 4) {
      throw new ValidationError('Invalid code format');
    }

    const result = await validateReferralCode(code);

    if (!result.valid) {
      return {
        success: false,
        valid: false,
        error: result.error,
      };
    }

    return {
      success: true,
      valid: true,
      karmaBonus: result.codeData.karmaReward,
    };
  });

  /**
   * GET /api/referrals/stats
   * Get referral leaderboard (top referrers)
   */
  app.get<{
    Querystring: { limit?: string; offset?: string }
  }>('/stats', async (request: FastifyRequest<{
    Querystring: { limit?: string; offset?: string }
  }>) => {
    const limit = Math.min(parseInt(request.query.limit || '20'), 100);
    const offset = parseInt(request.query.offset || '0');

    // Get top referrers (agents and humans combined)
    // This requires querying both tables and combining results
    const agentReferrers = await db
      .select({
        id: referralCodes.creatorId,
        type: sql<string>`'agent'`,
        name: agents.name,
        totalReferrals: sql<number>`COUNT(DISTINCT ${referralUses.id})`,
        totalKarma: sql<number>`COALESCE(SUM(${referralUses.karmaAwarded}), 0)`,
      })
      .from(referralCodes)
      .leftJoin(referralUses, eq(referralUses.codeId, referralCodes.id))
      .leftJoin(agents, eq(agents.id, referralCodes.creatorId))
      .where(eq(referralCodes.creatorType, 'agent'))
      .groupBy(referralCodes.creatorId, agents.name)
      .orderBy(desc(sql`COUNT(DISTINCT ${referralUses.id})`))
      .limit(limit);

    const humanReferrers = await db
      .select({
        id: referralCodes.creatorId,
        type: sql<string>`'human'`,
        name: humans.username,
        totalReferrals: sql<number>`COUNT(DISTINCT ${referralUses.id})`,
        totalKarma: sql<number>`COALESCE(SUM(${referralUses.karmaAwarded}), 0)`,
      })
      .from(referralCodes)
      .leftJoin(referralUses, eq(referralUses.codeId, referralCodes.id))
      .leftJoin(humans, eq(humans.id, referralCodes.creatorId))
      .where(eq(referralCodes.creatorType, 'human'))
      .groupBy(referralCodes.creatorId, humans.username)
      .orderBy(desc(sql`COUNT(DISTINCT ${referralUses.id})`))
      .limit(limit);

    // Combine and sort
    const combined = [...agentReferrers, ...humanReferrers]
      .sort((a, b) => Number(b.totalReferrals) - Number(a.totalReferrals))
      .slice(offset, offset + limit);

    return {
      success: true,
      leaderboard: combined.map(r => ({
        id: r.id,
        type: r.type,
        name: r.name,
        totalReferrals: Number(r.totalReferrals),
        totalKarmaEarned: Number(r.totalKarma),
      })),
      pagination: {
        limit,
        offset,
        hasMore: combined.length === limit,
      },
    };
  });

  /**
   * DELETE /api/referrals/:codeId
   * Delete a referral code (must be owner)
   */
  app.delete<{ Params: { codeId: string } }>('/:codeId', {
    preHandler: authenticateUnified,
  }, async (request: FastifyRequest<{ Params: { codeId: string } }>, reply) => {
    const currentAgent = request.agent;
    const currentHuman = request.human;
    const { codeId } = request.params;

    const userId = currentAgent ? currentAgent.id : currentHuman!.id;
    const userType = currentAgent ? 'agent' : 'human';

    // Find the code
    const [code] = await db
      .select()
      .from(referralCodes)
      .where(eq(referralCodes.id, codeId))
      .limit(1);

    if (!code) {
      throw new NotFoundError('Referral code');
    }

    // Check ownership
    if (code.creatorId !== userId || code.creatorType !== userType) {
      throw new ValidationError('You can only delete your own referral codes');
    }

    // Delete the code (cascade will delete uses)
    await db
      .delete(referralCodes)
      .where(eq(referralCodes.id, codeId));

    return reply.status(200).send({
      success: true,
      message: 'Referral code deleted',
    });
  });
}
