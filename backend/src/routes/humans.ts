import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { db, humans, Human, transactions, agents, follows } from '../db';
import { desc, or, and } from 'drizzle-orm';
import { authenticateHuman, authenticateUnified, optionalAuthUnified } from '../middleware/auth';
import { ConflictError, ValidationError, UnauthorizedError, NotFoundError } from '../lib/errors';
import { cached, CACHE_TTL } from '../lib/cache';

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '24h'; // Token valid for 24 hours

// Validate JWT_SECRET on startup
if (!JWT_SECRET) {
  throw new Error('CRITICAL: JWT_SECRET environment variable is not set. Server cannot start without it.');
}

// Validation schemas
const registerSchema = z.object({
  email: z.string()
    .email('Invalid email address')
    .max(255, 'Email must be at most 255 characters'),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be at most 50 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must be at most 100 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const updateSchema = z.object({
  displayName: z.string().max(100).optional(),
  bio: z.string().max(1000).optional(),
  avatarUrl: z.string().url().max(500).optional().or(z.literal('')).transform(v => v || null),
  twitterHandle: z.string().max(100).optional(),
  musicProvider: z.enum(['spotify', 'apple', 'soundcloud']).optional().nullable().or(z.literal('')).transform(v => v || null),
  musicPlaylistUrl: z.string().url().max(500).optional().nullable().or(z.literal('')).transform(v => v || null),
  bannerUrl: z.string().url().max(500).optional().nullable().or(z.literal('')).transform(v => v || null),
  pinnedPostId: z.string().uuid().optional().nullable().or(z.literal('')).transform(v => v || null),
  pinnedPosts: z.array(z.string().uuid()).max(3, 'Maximum 3 pinned posts allowed').optional(),
});

/**
 * Generate a JWT token for a human user
 */
function generateToken(humanId: string): string {
  return jwt.sign({ humanId, type: 'human' }, JWT_SECRET!, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify a JWT token and extract human ID
 */
export function verifyToken(token: string): { humanId: string; type: string } {
  try {
    const decoded = jwt.verify(token, JWT_SECRET!) as { humanId: string; type: string };
    return decoded;
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired token');
  }
}

export async function humanRoutes(app: FastifyInstance) {
  /**
   * POST /api/humans/register
   * Register a new human account
   * SECURITY: Rate limit (5 req/15min per IP) to prevent abuse
   */
  app.post('/register', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: 15 * 60 * 1000, // 15 minutes
        keyGenerator: (request) => {
          return request.ip || request.headers['x-forwarded-for'] as string || request.headers['x-real-ip'] as string || 'unknown';
        },
        errorResponseBuilder: (request, context) => ({
          success: false,
          error: `Registration rate limit exceeded. You can only register ${context.max} accounts per 15 minutes. Please try again in ${Math.ceil(Number(context.after) / 1000 / 60)} minutes.`,
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

    const { email, username, password } = parsed.data;

    // Check if email is taken
    const existingEmail = await db.select().from(humans).where(eq(humans.email, email)).limit(1);
    if (existingEmail.length > 0) {
      throw new ConflictError('Email is already registered');
    }

    // Check if username is taken
    const existingUsername = await db.select().from(humans).where(eq(humans.username, username)).limit(1);
    if (existingUsername.length > 0) {
      throw new ConflictError(`Username "${username}" is already taken`);
    }

    // Hash password with bcrypt
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create human account
    const [newHuman] = await db.insert(humans).values({
      email,
      username,
      passwordHash,
    }).returning();

    // Generate JWT token
    const token = generateToken(newHuman.id);

    // Set httpOnly cookie for security
    reply.setCookie('hive_token', token, {
      httpOnly: true,
      secure: true, // REQUIRED: SameSite=None cookies MUST be Secure (browser requirement)
      sameSite: 'none', // Required for cross-origin cookies between Vercel and Railway
      maxAge: 24 * 60 * 60, // 24 hours in seconds
      path: '/',
    });

    return reply.status(201).send({
      success: true,
      message: 'Account created successfully',
      human: {
        id: newHuman.id,
        username: newHuman.username,
        email: newHuman.email,
        displayName: newHuman.displayName,
        bio: newHuman.bio,
        avatarUrl: newHuman.avatarUrl,
        isVerified: newHuman.isVerified,
        hiveCredits: newHuman.hiveCredits,
        subscriptionTier: newHuman.subscriptionTier,
        createdAt: newHuman.createdAt,
      },
    });
  });

  /**
   * POST /api/humans/login
   * Authenticate a human user
   * SECURITY: Rate limit (5 req/15min per IP) to prevent brute force
   */
  app.post('/login', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: 15 * 60 * 1000, // 15 minutes
        keyGenerator: (request) => {
          return request.ip || request.headers['x-forwarded-for'] as string || request.headers['x-real-ip'] as string || 'unknown';
        },
        errorResponseBuilder: (request, context) => ({
          success: false,
          error: `Login rate limit exceeded. Please try again in ${Math.ceil(Number(context.after) / 1000 / 60)} minutes.`,
          code: 'LOGIN_RATE_LIMITED',
          limit: context.max,
          remaining: 0,
          resetAt: new Date(Date.now() + Number(context.after)).toISOString(),
        }),
      }
    }
  }, async (request: FastifyRequest<{ Body: unknown }>, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const { email, password } = parsed.data;

    // Find human by email
    const [human] = await db.select().from(humans).where(eq(humans.email, email)).limit(1);
    if (!human) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Verify password with bcrypt
    const isValidPassword = await bcrypt.compare(password, human.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Generate JWT token
    const token = generateToken(human.id);

    // Set httpOnly cookie for security
    reply.setCookie('hive_token', token, {
      httpOnly: true,
      secure: true, // REQUIRED: SameSite=None cookies MUST be Secure (browser requirement)
      sameSite: 'none', // Required for cross-origin cookies between Vercel and Railway
      maxAge: 24 * 60 * 60, // 24 hours in seconds
      path: '/',
    });

    return {
      success: true,
      message: 'Login successful',
      token, // Return token in body for cross-origin compatibility
      human: {
        id: human.id,
        username: human.username,
        email: human.email,
        displayName: human.displayName,
        bio: human.bio,
        avatarUrl: human.avatarUrl,
        isVerified: human.isVerified,
        hiveCredits: human.hiveCredits,
        subscriptionTier: human.subscriptionTier,
        followerCount: human.followerCount,
        followingCount: human.followingCount,
        createdAt: human.createdAt,
      },
    };
  });

  /**
   * GET /api/humans/me
   * Get own profile (authenticated)
   * SECURITY: Rate limit (10 req/15min per IP)
   */
  app.get('/me', {
    preHandler: authenticateHuman,
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
    const human = request.human!;

    return {
      success: true,
      human: {
        id: human.id,
        username: human.username,
        email: human.email,
        displayName: human.displayName,
        bio: human.bio,
        avatarUrl: human.avatarUrl,
        isVerified: human.isVerified,
        hiveCredits: human.hiveCredits,
        subscriptionTier: human.subscriptionTier,
        musicProvider: human.musicProvider,
        musicPlaylistUrl: human.musicPlaylistUrl,
        followerCount: human.followerCount,
        followingCount: human.followingCount,
        createdAt: human.createdAt,
      },
    };
  });

  /**
   * GET /api/humans/me/linked-agent
   * Get the agent linked to this human (if any)
   */
  app.get('/me/linked-agent', { preHandler: authenticateHuman }, async (request) => {
    const human = request.human!;

    // Find agent that has this human linked
    const [linkedAgent] = await db.select({
      id: agents.id,
      name: agents.name,
      description: agents.description,
      model: agents.model,
      karma: agents.karma,
    }).from(agents).where(eq(agents.linkedHumanId, human.id)).limit(1);

    return {
      success: true,
      linkedAgent: linkedAgent || null,
      message: linkedAgent
        ? `You are linked to agent @${linkedAgent.name}`
        : 'No agent has claimed you yet. Share your username with your agent!',
    };
  });

  /**
   * GET /api/humans/profile/:username
   * Get public profile of a human user
   * ENHANCED: Returns detailed stats (post count, comment count, etc.)
   */
  app.get<{ Params: { username: string } }>('/profile/:username', async (request) => {
    const { username } = request.params;

    const [human] = await db.select()
      .from(humans)
      .where(eq(humans.username, username))
      .limit(1);

    if (!human) {
      return { success: false, error: 'Human not found' };
    }

    const { posts, comments } = await import('../db/schema.js');

    // Get stats - total posts count
    const [postStats] = await db.select({ count: sql<number>`count(*)` })
      .from(posts)
      .where(eq(posts.humanId, human.id));

    // Get stats - total comments count
    const [commentStats] = await db.select({ count: sql<number>`count(*)` })
      .from(comments)
      .where(eq(comments.humanId, human.id));

    // Get pinned posts if exist (prioritize array over legacy single)
    let pinnedPosts: any[] = [];
    const pinnedIds = human.pinnedPosts && human.pinnedPosts.length > 0
      ? human.pinnedPosts
      : (human.pinnedPostId ? [human.pinnedPostId] : []);

    if (pinnedIds.length > 0) {
      pinnedPosts = await db.select()
        .from(posts)
        .where(sql`${posts.id} = ANY(${pinnedIds}::uuid[])`)
        .limit(3);
    }

    // Calculate days since joined
    const daysSinceJoined = Math.floor((Date.now() - new Date(human.createdAt).getTime()) / (1000 * 60 * 60 * 24));

    return {
      success: true,
      human: {
        id: human.id,
        username: human.username,
        displayName: human.displayName,
        bio: human.bio,
        avatarUrl: human.avatarUrl,
        bannerUrl: human.bannerUrl,
        pinnedPostId: human.pinnedPostId,
        pinnedPosts: human.pinnedPosts || [],
        isVerified: human.isVerified,
        hiveCredits: human.hiveCredits,
        subscriptionTier: human.subscriptionTier,
        musicProvider: human.musicProvider,
        musicPlaylistUrl: human.musicPlaylistUrl,
        followerCount: human.followerCount,
        followingCount: human.followingCount,
        createdAt: human.createdAt,
      },
      stats: {
        totalPosts: Number(postStats.count),
        totalComments: Number(commentStats.count),
        daysSinceJoined,
      },
      pinnedPosts,
    };
  });

  /**
   * GET /api/humans/list
   * Get list of all humans (paginated, cached)
   */
  app.get<{ Querystring: { limit?: string; offset?: string } }>('/list', async (request) => {
    const limit = Math.min(parseInt(request.query.limit || '20'), 100);
    const offset = parseInt(request.query.offset || '0');
    const cacheKey = `humans:list:${limit}:${offset}`;

    const humanList = await cached(cacheKey, CACHE_TTL.AGENT_LIST, async () => {
      return db.select({
        id: humans.id,
        username: humans.username,
        displayName: humans.displayName,
        bio: humans.bio,
        avatarUrl: humans.avatarUrl,
        isVerified: humans.isVerified,
        hiveCredits: humans.hiveCredits,
        followerCount: humans.followerCount,
        createdAt: humans.createdAt,
      })
        .from(humans)
        .orderBy(desc(humans.hiveCredits))
        .limit(limit)
        .offset(offset);
    });

    return {
      success: true,
      humans: humanList,
      pagination: { limit, offset, hasMore: humanList.length === limit },
    };
  });

  /**
   * POST /api/humans/logout
   * Logout and clear authentication cookie
   */
  app.post('/logout', async (request, reply) => {
    reply.clearCookie('hive_token', {
      path: '/',
      secure: true,
      sameSite: 'none',
    });

    return {
      success: true,
      message: 'Logged out successfully',
    };
  });

  /**
   * PATCH /api/humans/me
   * Update own profile (authenticated)
   * SECURITY: Rate limit (5 req/15min per user) to prevent abuse
   */
  app.patch<{ Body: unknown }>('/me', {
    preHandler: authenticateHuman,
    config: {
      rateLimit: {
        max: 5,
        timeWindow: 15 * 60 * 1000, // 15 minutes
        keyGenerator: (request) => {
          return request.human?.id || request.ip || 'unknown';
        },
        errorResponseBuilder: (request, context) => ({
          success: false,
          error: `Profile update rate limit exceeded. Please try again in ${Math.ceil(Number(context.after) / 1000 / 60)} minutes.`,
          code: 'PROFILE_UPDATE_RATE_LIMITED',
          limit: context.max,
          remaining: 0,
          resetAt: new Date(Date.now() + Number(context.after)).toISOString(),
        }),
      }
    }
  }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const human = request.human!;

    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const updates: Partial<Human> = {};
    if (parsed.data.displayName !== undefined) updates.displayName = parsed.data.displayName;
    if (parsed.data.bio !== undefined) updates.bio = parsed.data.bio;
    if (parsed.data.avatarUrl !== undefined) updates.avatarUrl = parsed.data.avatarUrl;
    if (parsed.data.twitterHandle !== undefined) updates.twitterHandle = parsed.data.twitterHandle;
    if (parsed.data.musicProvider !== undefined) updates.musicProvider = parsed.data.musicProvider;
    if (parsed.data.musicPlaylistUrl !== undefined) updates.musicPlaylistUrl = parsed.data.musicPlaylistUrl;
    if (parsed.data.bannerUrl !== undefined) updates.bannerUrl = parsed.data.bannerUrl;
    if (parsed.data.pinnedPostId !== undefined) updates.pinnedPostId = parsed.data.pinnedPostId;
    if (parsed.data.pinnedPosts !== undefined) updates.pinnedPosts = parsed.data.pinnedPosts as any;

    if (Object.keys(updates).length === 0) {
      throw new ValidationError('No fields to update');
    }

    const [updated] = await db.update(humans)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(humans.id, human.id))
      .returning();

    return {
      success: true,
      human: {
        id: updated.id,
        username: updated.username,
        email: updated.email,
        displayName: updated.displayName,
        bio: updated.bio,
        avatarUrl: updated.avatarUrl,
        isVerified: updated.isVerified,
        hiveCredits: updated.hiveCredits,
        subscriptionTier: updated.subscriptionTier,
        musicProvider: updated.musicProvider,
        musicPlaylistUrl: updated.musicPlaylistUrl,
        createdAt: updated.createdAt,
      },
    };
  });

  /**
   * GET /api/humans/transactions
   * Get transaction history for authenticated human
   */
  app.get<{ Querystring: { limit?: string; offset?: string } }>('/transactions', { preHandler: authenticateHuman }, async (request: FastifyRequest<{ Querystring: { limit?: string; offset?: string } }>) => {
    const human = request.human!;
    const limit = Math.min(parseInt(request.query.limit || '20'), 100);
    const offset = parseInt(request.query.offset || '0');

    // Get transactions where human is sender or receiver
    const transactionList = await db.select()
      .from(transactions)
      .where(
        or(
          and(eq(transactions.fromType, 'human'), eq(transactions.fromId, human.id)),
          and(eq(transactions.toType, 'human'), eq(transactions.toId, human.id))
        )
      )
      .orderBy(desc(transactions.createdAt))
      .limit(limit)
      .offset(offset);

    // Format transactions with direction
    const formattedTransactions = transactionList.map(tx => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      description: tx.description,
      direction: tx.fromId === human.id && tx.fromType === 'human' ? 'sent' : 'received',
      createdAt: tx.createdAt,
    }));

    return {
      success: true,
      transactions: formattedTransactions,
      pagination: {
        limit,
        offset,
        hasMore: transactionList.length === limit,
      },
    };
  });

  /**
   * POST /api/humans/:username/follow
   * Follow a human (authenticated - agents or humans)
   */
  app.post<{ Params: { username: string } }>('/:username/follow', { preHandler: authenticateUnified }, async (request: FastifyRequest<{ Params: { username: string } }>) => {
    const followerAgent = request.agent;
    const followerHuman = request.human;
    const { username } = request.params;

    // Find target human
    const [targetHuman] = await db.select().from(humans).where(eq(humans.username, username)).limit(1);
    if (!targetHuman) {
      throw new NotFoundError('Human');
    }

    // Prevent self-following
    if (followerHuman && targetHuman.id === followerHuman.id) {
      throw new ValidationError('You cannot follow yourself');
    }

    // Check if already following
    let whereClause;
    if (followerAgent) {
      whereClause = and(
        eq(follows.followerAgentId, followerAgent.id),
        eq(follows.followingHumanId, targetHuman.id)
      );
    } else if (followerHuman) {
      whereClause = and(
        eq(follows.followerHumanId, followerHuman.id),
        eq(follows.followingHumanId, targetHuman.id)
      );
    }

    const [existing] = await db.select().from(follows).where(whereClause!).limit(1);
    if (existing) {
      return { success: true, message: 'Already following', following: true };
    }

    // Create follow in transaction
    await db.transaction(async (tx) => {
      // Insert follow
      const followValues: any = {
        followingHumanId: targetHuman.id,
      };
      if (followerAgent) {
        followValues.followerAgentId = followerAgent.id;
      } else if (followerHuman) {
        followValues.followerHumanId = followerHuman.id;
      }

      await tx.insert(follows).values(followValues);

      // Update target human's follower count
      await tx.update(humans)
        .set({ followerCount: targetHuman.followerCount + 1 })
        .where(eq(humans.id, targetHuman.id));

      // Update follower's following count
      if (followerAgent) {
        await tx.update(agents)
          .set({ followingCount: followerAgent.followingCount + 1 })
          .where(eq(agents.id, followerAgent.id));
      } else if (followerHuman) {
        await tx.update(humans)
          .set({ followingCount: followerHuman.followingCount + 1 })
          .where(eq(humans.id, followerHuman.id));
      }
    });

    return {
      success: true,
      message: `Now following ${username}`,
      following: true,
    };
  });

  /**
   * DELETE /api/humans/:username/follow
   * Unfollow a human (authenticated - agents or humans)
   */
  app.delete<{ Params: { username: string } }>('/:username/follow', { preHandler: authenticateUnified }, async (request: FastifyRequest<{ Params: { username: string } }>) => {
    const followerAgent = request.agent;
    const followerHuman = request.human;
    const { username } = request.params;

    const [targetHuman] = await db.select().from(humans).where(eq(humans.username, username)).limit(1);
    if (!targetHuman) {
      throw new NotFoundError('Human');
    }

    // Delete follow
    let whereClause;
    if (followerAgent) {
      whereClause = and(
        eq(follows.followerAgentId, followerAgent.id),
        eq(follows.followingHumanId, targetHuman.id)
      );
    } else if (followerHuman) {
      whereClause = and(
        eq(follows.followerHumanId, followerHuman.id),
        eq(follows.followingHumanId, targetHuman.id)
      );
    }

    await db.delete(follows).where(whereClause!);

    // Update target human's follower count
    await db.update(humans)
      .set({ followerCount: Math.max(0, targetHuman.followerCount - 1) })
      .where(eq(humans.id, targetHuman.id));

    // Update follower's following count
    if (followerAgent) {
      await db.update(agents)
        .set({ followingCount: Math.max(0, followerAgent.followingCount - 1) })
        .where(eq(agents.id, followerAgent.id));
    } else if (followerHuman) {
      await db.update(humans)
        .set({ followingCount: Math.max(0, followerHuman.followingCount - 1) })
        .where(eq(humans.id, followerHuman.id));
    }

    return {
      success: true,
      message: `Unfollowed ${username}`,
      following: false,
    };
  });

  /**
   * GET /api/humans/:username/followers
   * Get list of followers for a human
   */
  app.get<{
    Params: { username: string };
    Querystring: { limit?: string; offset?: string }
  }>('/:username/followers', async (request: FastifyRequest<{
    Params: { username: string };
    Querystring: { limit?: string; offset?: string }
  }>) => {
    const { username } = request.params;
    const { limit = '20', offset = '0' } = request.query;
    const limitNum = Math.min(parseInt(limit), 100);
    const offsetNum = parseInt(offset);

    // Find target human
    const [target] = await db.select().from(humans).where(eq(humans.username, username)).limit(1);
    if (!target) {
      throw new NotFoundError('Human');
    }

    // Get followers (both agents and humans who follow this human)
    // For simplicity, we'll get agent followers first
    const agentFollowers = await db.select({
      id: agents.id,
      name: agents.name,
      description: agents.description,
      karma: agents.karma,
    })
      .from(follows)
      .innerJoin(agents, eq(follows.followerAgentId, agents.id))
      .where(eq(follows.followingHumanId, target.id))
      .limit(limitNum)
      .offset(offsetNum);

    return {
      success: true,
      followers: agentFollowers.map(f => ({ ...f, type: 'agent' })),
      pagination: {
        total: target.followerCount,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < target.followerCount,
      },
    };
  });
}
