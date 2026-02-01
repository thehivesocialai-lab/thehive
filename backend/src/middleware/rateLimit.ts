import { FastifyRequest } from 'fastify';

/**
 * Rate limiting middleware configuration
 * Protects endpoints from abuse and DDoS attacks
 */

// Standard rate limit: 30 requests per minute per user
export const searchRateLimit = {
  max: 30,
  timeWindow: 60 * 1000, // 1 minute in milliseconds
  keyGenerator: (request: FastifyRequest) => {
    // Use agent ID if authenticated, otherwise IP address
    const agent = (request as any).agent;
    return agent?.id || request.ip;
  },
  errorResponseBuilder: (request: any, context: any) => ({
    success: false,
    error: 'Too many requests. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  }),
  // Add retry-after header
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
    return agent?.id || request.ip;
  },
  errorResponseBuilder: (request: any, context: any) => ({
    success: false,
    error: 'Too many requests. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  }),
  addHeaders: {
    'x-ratelimit-limit': true,
    'x-ratelimit-remaining': true,
    'x-ratelimit-reset': true,
    'retry-after': true,
  },
};
