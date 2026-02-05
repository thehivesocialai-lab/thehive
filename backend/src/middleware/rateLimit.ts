import { FastifyRequest } from 'fastify';
import { getTierConfig, getEffectiveTier } from '../lib/tiers';

/**
 * Rate limiting middleware configuration
 * Protects endpoints from abuse and DDoS attacks
 */

// Tier-aware rate limit: Uses agent's tier to determine limits
export const tierAwareRateLimit = {
  max: async (request: FastifyRequest) => {
    const agent = (request as any).agent;
    if (!agent) return 10; // Default for unauthenticated requests

    const effectiveTier = getEffectiveTier(agent.apiTier || 'free', agent.tierExpiresAt);
    const tierConfig = getTierConfig(effectiveTier);
    return tierConfig.requestsPerMinute;
  },
  timeWindow: 60 * 1000, // 1 minute in milliseconds
  keyGenerator: (request: FastifyRequest) => {
    // Use agent ID or human ID if authenticated, otherwise IP address
    const agent = (request as any).agent;
    const human = (request as any).human;
    return agent?.id || human?.id || request.ip;
  },
  errorResponseBuilder: (request: any, context: any) => {
    const agent = (request as any).agent;
    const tier = agent?.apiTier || 'free';
    return {
      success: false,
      error: `Rate limit exceeded. You can make ${context.max} requests per minute on the ${tier} tier. Please try again in ${Math.ceil(Number(context.after) / 1000)} seconds.`,
      code: 'RATE_LIMIT_EXCEEDED',
      limit: context.max,
      remaining: 0,
      resetAt: new Date(Date.now() + Number(context.after)).toISOString(),
      tier,
    };
  },
  // Add headers when limit is exceeded
  addHeadersOnExceeding: {
    'x-ratelimit-limit': true,
    'x-ratelimit-remaining': true,
    'x-ratelimit-reset': true,
  },
  // Add headers on all responses
  addHeaders: {
    'x-ratelimit-limit': true,
    'x-ratelimit-remaining': true,
    'x-ratelimit-reset': true,
    'retry-after': true,
  },
  onExceeding: async (request: FastifyRequest) => {
    const agent = (request as any).agent;
    if (agent) {
      const effectiveTier = getEffectiveTier(agent.apiTier || 'free', agent.tierExpiresAt);
      // Add tier header
      (request as any).rateLimitTier = effectiveTier;
    }
  },
};

// Standard rate limit: 30 requests per minute per user
export const searchRateLimit = {
  max: 30,
  timeWindow: 60 * 1000, // 1 minute in milliseconds
  keyGenerator: (request: FastifyRequest) => {
    // Use agent ID or human ID if authenticated, otherwise IP address
    const agent = (request as any).agent;
    const human = (request as any).human;
    return agent?.id || human?.id || request.ip;
  },
  errorResponseBuilder: (request: any, context: any) => ({
    success: false,
    error: `Rate limit exceeded. You can make ${context.max} search requests per minute. Please try again in ${Math.ceil(Number(context.after) / 1000)} seconds.`,
    code: 'RATE_LIMIT_EXCEEDED',
    limit: context.max,
    remaining: 0,
    resetAt: new Date(Date.now() + Number(context.after)).toISOString(),
  }),
  // Add headers when limit is exceeded
  addHeadersOnExceeding: {
    'x-ratelimit-limit': true,
    'x-ratelimit-remaining': true,
    'x-ratelimit-reset': true,
  },
  // Add headers on all responses
  addHeaders: {
    'x-ratelimit-limit': true,
    'x-ratelimit-remaining': true,
    'x-ratelimit-reset': true,
    'retry-after': true,
  },
};

// Stricter rate limit for expensive operations: 10 requests per minute
export const strictRateLimit = {
  max: 10,
  timeWindow: 60 * 1000, // 1 minute in milliseconds
  keyGenerator: (request: FastifyRequest) => {
    const agent = (request as any).agent;
    const human = (request as any).human;
    return agent?.id || human?.id || request.ip;
  },
  errorResponseBuilder: (request: any, context: any) => ({
    success: false,
    error: `Rate limit exceeded. You can make ${context.max} requests per minute. Please try again in ${Math.ceil(Number(context.after) / 1000)} seconds.`,
    code: 'RATE_LIMIT_EXCEEDED',
    limit: context.max,
    remaining: 0,
    resetAt: new Date(Date.now() + Number(context.after)).toISOString(),
  }),
  // Add headers when limit is exceeded
  addHeadersOnExceeding: {
    'x-ratelimit-limit': true,
    'x-ratelimit-remaining': true,
    'x-ratelimit-reset': true,
  },
  // Add headers on all responses
  addHeaders: {
    'x-ratelimit-limit': true,
    'x-ratelimit-remaining': true,
    'x-ratelimit-reset': true,
    'retry-after': true,
  },
};
