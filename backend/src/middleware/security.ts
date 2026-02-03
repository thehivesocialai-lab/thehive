/**
 * Security middleware for TheHive API
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  detectSuspiciousContent,
  getRealIp,
  isLikelyBot,
  logSecurityEvent,
  sanitizeText,
} from '../lib/security';

/**
 * Register security middleware
 */
export async function registerSecurityMiddleware(app: FastifyInstance) {
  // Hook: Check for suspicious requests before processing
  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const ip = getRealIp(request);

    // Skip security checks for health endpoints
    if (request.url === '/health' || request.url === '/api') {
      return;
    }

    // Block obvious bots on certain endpoints (but allow API access)
    if (
      isLikelyBot(request) &&
      !request.headers['authorization'] &&
      ['POST', 'PUT', 'DELETE'].includes(request.method) &&
      !request.url.includes('/agents/register') // Allow agent registration
    ) {
      logSecurityEvent({
        type: 'bot_blocked',
        ip,
        details: `User-Agent: ${request.headers['user-agent']}`,
      });

      return reply.status(403).send({
        success: false,
        error: 'Automated requests blocked. Please use a proper client.',
        code: 'BOT_BLOCKED',
      });
    }

    // Check body for suspicious content on POST/PUT requests
    if (['POST', 'PUT', 'PATCH'].includes(request.method) && request.body) {
      const body = request.body as Record<string, any>;

      // Check text fields for suspicious content
      for (const [key, value] of Object.entries(body)) {
        if (typeof value === 'string' && value.length > 0) {
          const check = detectSuspiciousContent(value);

          if (check.suspicious) {
            logSecurityEvent({
              type: check.reason === 'potential_injection' ? 'injection_attempt' : 'suspicious_content',
              ip,
              details: `Field: ${key}, Reason: ${check.reason}`,
            });

            // Block injection attempts immediately
            if (check.reason === 'potential_injection') {
              return reply.status(400).send({
                success: false,
                error: 'Invalid content detected.',
                code: 'INVALID_CONTENT',
              });
            }

            // For other suspicious content, sanitize and continue
            (body as any)[key] = sanitizeText(value);
          }
        }
      }
    }
  });

  // Hook: Add security headers to all responses
  app.addHook('onSend', async (request, reply, payload) => {
    // Prevent content type sniffing
    reply.header('X-Content-Type-Options', 'nosniff');

    // Prevent clickjacking (already set by Helmet, but ensure)
    reply.header('X-Frame-Options', 'DENY');

    // XSS protection
    reply.header('X-XSS-Protection', '1; mode=block');

    // Referrer policy
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions policy - restrict dangerous features
    reply.header(
      'Permissions-Policy',
      'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
    );

    return payload;
  });

  // Log authentication failures
  app.addHook('onError', async (request, reply, error) => {
    const ip = getRealIp(request);

    // Log auth failures
    if (error.statusCode === 401 || error.statusCode === 403) {
      logSecurityEvent({
        type: 'auth_failure',
        ip,
        details: `URL: ${request.url}, Method: ${request.method}`,
      });
    }

    // Log rate limits
    if (error.statusCode === 429) {
      logSecurityEvent({
        type: 'rate_limited',
        ip,
        details: `URL: ${request.url}`,
      });
    }
  });

  // Add admin endpoint to view security log (protected)
  app.get('/api/admin/security-log', async (request: FastifyRequest, reply: FastifyReply) => {
    // Only allow with admin secret
    const adminSecret = process.env.ADMIN_SECRET;
    const providedSecret = request.headers['x-admin-secret'];

    if (!adminSecret || providedSecret !== adminSecret) {
      return reply.status(403).send({
        success: false,
        error: 'Unauthorized',
      });
    }

    const { getSecurityLog, countSecurityEvents } = await import('../lib/security.js');

    return {
      success: true,
      recentEvents: getSecurityLog(100),
      stats: {
        last5min: {
          authFailures: countSecurityEvents('auth_failure', 5),
          rateLimited: countSecurityEvents('rate_limited', 5),
          suspiciousContent: countSecurityEvents('suspicious_content', 5),
          injectionAttempts: countSecurityEvents('injection_attempt', 5),
          botsBlocked: countSecurityEvents('bot_blocked', 5),
        },
        last60min: {
          authFailures: countSecurityEvents('auth_failure', 60),
          rateLimited: countSecurityEvents('rate_limited', 60),
          suspiciousContent: countSecurityEvents('suspicious_content', 60),
          injectionAttempts: countSecurityEvents('injection_attempt', 60),
          botsBlocked: countSecurityEvents('bot_blocked', 60),
        },
      },
    };
  });
}
