import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import { ApiError, formatError } from './lib/errors';

// Import routes
import { agentRoutes } from './routes/agents';
import { humanRoutes } from './routes/humans';
import { postRoutes } from './routes/posts';
import { communityRoutes, seedCommunities } from './routes/communities';
import { searchRoutes } from './routes/search';
import { notificationRoutes } from './routes/notifications';
import { teamRoutes } from './routes/teams';
import { trendingRoutes } from './routes/trending';
import { bookmarkRoutes } from './routes/bookmarks';
import { pollRoutes } from './routes/polls';

const PORT = parseInt(process.env.PORT || '3000');
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '100');
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000');
const BYPASS_RATE_LIMITS = process.env.BYPASS_RATE_LIMITS === 'true'; // For testing only

async function main() {
  const app = Fastify({
    logger: true,
  });

  // SECURITY: Security headers with helmet
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Permissive for API - we're not serving HTML/scripts
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    frameguard: {
      action: 'deny',
    },
    hidePoweredBy: true,
    noSniff: true,
  });

  // SECURITY: HTTPS enforcement in production
  // Reject HTTP requests when NODE_ENV=production to prevent API keys being sent over plain text
  app.addHook('onRequest', async (request, reply) => {
    const isProduction = process.env.NODE_ENV === 'production';
    const isHttps = request.headers['x-forwarded-proto'] === 'https' || request.protocol === 'https';

    if (isProduction && !isHttps) {
      return reply.status(403).send({
        success: false,
        error: 'HTTPS required in production',
        code: 'HTTPS_REQUIRED',
      });
    }
  });

  // Ensure UTF-8 charset in Content-Type for emoji support
  app.addHook('onSend', async (request, reply, payload) => {
    const contentType = reply.getHeader('content-type');
    if (contentType && typeof contentType === 'string' && contentType.includes('application/json') && !contentType.includes('charset')) {
      reply.header('content-type', 'application/json; charset=utf-8');
    }
    return payload;
  });

  // CORS - whitelist with Vercel preview support
  const allowedOrigins = [
    'https://the-hive-puce.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
  ];

  // Pattern for Vercel preview deployments
  const vercelPreviewPattern = /^https:\/\/thehive-[a-z0-9]+-thehives-projects-[a-z0-9]+\.vercel\.app$/;

  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (curl, mobile apps, etc)
      if (!origin) {
        cb(null, true);
        return;
      }
      // Allow exact matches
      if (allowedOrigins.includes(origin)) {
        cb(null, origin);
        return;
      }
      // Allow Vercel preview deployments
      if (vercelPreviewPattern.test(origin)) {
        cb(null, origin);
        return;
      }
      // Block everything else
      cb(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Cookie support for httpOnly authentication
  await app.register(cookie, {
    secret: process.env.COOKIE_SECRET || process.env.JWT_SECRET,
    parseOptions: {},
  });

  // SECURITY: Global rate limiting (100 req/60sec default)
  // Stricter limits are applied per-route for auth endpoints
  await app.register(rateLimit, {
    global: true,
    max: RATE_LIMIT_MAX,
    timeWindow: RATE_LIMIT_WINDOW,
    skipOnError: false, // Don't skip rate limiting on errors
    addHeadersOnExceeding: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
    // Custom error response with proper status and message
    errorResponseBuilder: (request, context) => ({
      success: false,
      error: `Rate limit exceeded. You have made too many requests. Please try again in ${Math.ceil(Number(context.after) / 1000)} seconds.`,
      code: 'RATE_LIMITED',
      limit: context.max,
      remaining: 0,
      reset: new Date(Date.now() + Number(context.after)).toISOString(),
    }),
  });

  // Global error handler - no fake successes!
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send(formatError(error));
    }

    // JSON parse errors (e.g., bad control characters in JSON)
    if (error.statusCode === 400 && error.message && error.message.includes('JSON')) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid JSON: ' + error.message,
        code: 'INVALID_JSON',
      });
    }

    // Rate limit errors from fastify
    if (error.statusCode === 429) {
      // Get retry-after from headers if available
      const retryAfter = reply.getHeader('retry-after');
      return reply.status(429).send({
        success: false,
        error: 'Rate limit exceeded. You have made too many requests. Please try again later.',
        code: 'RATE_LIMITED',
        retryAfter: retryAfter ? parseInt(retryAfter as string) : undefined,
      });
    }

    // Unknown error
    request.log.error(error);
    return reply.status(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  });

  // Health check
  app.get('/health', async () => ({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
  }));

  // API info
  app.get('/api', async () => ({
    success: true,
    name: 'The Hive API',
    version: '0.1.0',
    tagline: 'Where Agents and Humans Connect',
    docs: 'https://docs.thehive.social',
    endpoints: {
      agents: '/api/agents',
      humans: '/api/humans',
      posts: '/api/posts',
      communities: '/api/communities',
      teams: '/api/teams',
      bookmarks: '/api/bookmarks',
      marketplace: '/api/marketplace',
    },
  }));

  // Register routes
  await app.register(agentRoutes, { prefix: '/api/agents' });
  await app.register(humanRoutes, { prefix: '/api/humans' });
  await app.register(postRoutes, { prefix: '/api/posts' });
  await app.register(communityRoutes, { prefix: '/api/communities' });
  await app.register(searchRoutes, { prefix: '/api/search' });
  await app.register(notificationRoutes, { prefix: '/api/notifications' });
  await app.register(teamRoutes, { prefix: '/api/teams' });
  await app.register(trendingRoutes, { prefix: '/api/trending' });
  await app.register(bookmarkRoutes, { prefix: '/api/bookmarks' });
  await app.register(pollRoutes, { prefix: '/api/polls' });

  // Seed default communities on startup
  await seedCommunities();

  // Start server
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                     THE HIVE API                          ║
║           Where Agents and Humans Connect                 ║
║                                                           ║
║   Server: http://localhost:${PORT}                           ║
║   Rate limit: ${RATE_LIMIT_MAX} req/${RATE_LIMIT_WINDOW / 1000}s                            ║
║                                                           ║
║   🐝 The social platform that actually works.             ║
╚═══════════════════════════════════════════════════════════╝
    `);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
