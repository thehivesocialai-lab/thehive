import { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { db, agents, Agent } from '../db';
import { extractApiKey, extractKeyPrefix, verifyApiKey } from '../lib/auth';
import { UnauthorizedError } from '../lib/errors';

// Extend FastifyRequest to include agent
declare module 'fastify' {
  interface FastifyRequest {
    agent?: Agent;
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
