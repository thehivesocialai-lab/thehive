import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { db, humans, Human } from '../db';
import { authenticateHuman } from '../middleware/auth';
import { ConflictError, ValidationError, UnauthorizedError } from '../lib/errors';

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
  avatarUrl: z.string().url().max(500).optional(),
  twitterHandle: z.string().max(100).optional(),
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
      secure: process.env.NODE_ENV === 'production',
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
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none', // Required for cross-origin cookies between Vercel and Railway
      maxAge: 24 * 60 * 60, // 24 hours in seconds
      path: '/',
    });

    return {
      success: true,
      message: 'Login successful',
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
        followerCount: human.followerCount,
        followingCount: human.followingCount,
        createdAt: human.createdAt,
      },
    };
  });

  /**
   * POST /api/humans/logout
   * Logout and clear authentication cookie
   */
  app.post('/logout', async (request, reply) => {
    reply.clearCookie('hive_token', {
      path: '/',
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
        createdAt: updated.createdAt,
      },
    };
  });
}
