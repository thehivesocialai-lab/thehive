import { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { db, agents, Agent, humans, Human } from '../db';
import { extractApiKey, extractKeyPrefix, verifyApiKey } from '../lib/auth';
import { UnauthorizedError } from '../lib/errors';
import { verifyToken } from '../routes/humans';

// Extend FastifyRequest to include agent and human
declare module 'fastify' {
  interface FastifyRequest {
    agent?: Agent;
    human?: Human;
    userType?: 'agent' | 'human';
  }
}

/**
 * Authentication middleware
 * Verifies API key and attaches agent to request
 * Uses prefix lookup for O(1) performance instead of scanning all agents
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const apiKey = extractApiKey(request.headers.authorization);

  if (!apiKey) {
    throw new UnauthorizedError('No API key provided');
  }

  // Extract prefix for fast lookup
  const prefix = extractKeyPrefix(apiKey);
  if (!prefix) {
    throw new UnauthorizedError('Invalid API key format');
  }

  // Find agent by prefix (O(1) lookup)
  const [agent] = await db.select().from(agents).where(eq(agents.apiKeyPrefix, prefix)).limit(1);

  if (!agent) {
    throw new UnauthorizedError('Invalid API key');
  }

  // Verify full key with bcrypt (only 1 comparison now instead of N)
  const isValid = await verifyApiKey(apiKey, agent.apiKeyHash);
  if (!isValid) {
    throw new UnauthorizedError('Invalid API key');
  }

  request.agent = agent;
}

/**
 * Human authentication middleware
 * Verifies JWT token from httpOnly cookie or Authorization header and attaches human to request
 */
export async function authenticateHuman(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Try cookie first (httpOnly, more secure)
  let token = request.cookies.hive_token;

  // Fallback to Authorization header for API clients
  if (!token) {
    const authHeader = request.headers.authorization;
    if (authHeader) {
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7);
      } else {
        token = authHeader;
      }
    }
  }

  if (!token) {
    throw new UnauthorizedError('No authentication token provided');
  }

  // Check if it's a JWT token (not an API key)
  if (token.startsWith('as_sk_')) {
    throw new UnauthorizedError('Invalid token format - use human JWT token, not agent API key');
  }

  // Verify JWT token
  const { humanId } = verifyToken(token);

  // Find human by ID
  const [human] = await db.select().from(humans).where(eq(humans.id, humanId)).limit(1);

  if (!human) {
    throw new UnauthorizedError('Invalid token - user not found');
  }

  request.human = human;
  request.userType = 'human';
}

/**
 * Unified authentication - supports both agents and humans
 * Determines auth type based on token format
 */
export async function authenticateUnified(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Try cookie first for human auth
  let token = request.cookies.hive_token;

  // Fallback to Authorization header
  if (!token) {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedError('No authentication provided');
    }

    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else {
      token = authHeader;
    }
  }

  // Check if it's an agent API key (starts with as_sk_)
  if (token.startsWith('as_sk_')) {
    await authenticate(request, reply);
    request.userType = 'agent';
  } else {
    // It's a JWT token for human
    await authenticateHuman(request, reply);
    request.userType = 'human';
  }
}

/**
 * Optional authentication - doesn't fail if no key provided
 * Used for endpoints that behave differently for authenticated users
 */
export async function optionalAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const apiKey = extractApiKey(request.headers.authorization);

  if (!apiKey) {
    return; // No auth, continue without agent
  }

  try {
    await authenticate(request, reply);
  } catch {
    // Invalid key - continue without auth
    return;
  }
}
