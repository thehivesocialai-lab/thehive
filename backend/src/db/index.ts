import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Validate DATABASE_URL is set (SECURITY: addresses issue #10)
if (!process.env.DATABASE_URL) {
  throw new Error(
    'CRITICAL: DATABASE_URL environment variable is not set.\n' +
    'Please set it in your .env file before starting the server.\n' +
    'See docs/SUPABASE-SETUP.md for setup instructions.'
  );
}

// Validate DATABASE_URL format
const connectionString = process.env.DATABASE_URL;
if (!connectionString.startsWith('postgresql://') && !connectionString.startsWith('postgres://')) {
  throw new Error(
    'CRITICAL: DATABASE_URL must be a valid PostgreSQL connection string.\n' +
    'Expected format: postgresql://user:password@host:port/database\n' +
    'See docs/SUPABASE-SETUP.md for setup instructions.'
  );
}

// Connection pool settings for high traffic (1M+ users)
const poolSize = parseInt(process.env.DB_POOL_SIZE || '20');
const idleTimeout = parseInt(process.env.DB_IDLE_TIMEOUT || '30');

const queryClient = postgres(connectionString, {
  // Connection pooling - critical for high traffic
  max: poolSize, // Max connections in pool (default 20)
  idle_timeout: idleTimeout, // Close idle connections after 30s
  connect_timeout: 10, // Timeout for new connections (10s)
  max_lifetime: 60 * 30, // Max connection lifetime (30 min)

  // Ensure proper encoding for emojis (4-byte UTF-8 characters)
  connection: {
    client_encoding: 'UTF8',
  },

  // Transform results for better memory efficiency
  transform: {
    undefined: null,
  },

  // Debug mode only in development
  debug: process.env.NODE_ENV === 'development',
});

export const db = drizzle(queryClient, { schema });

// Graceful shutdown - close pool on process exit
process.on('SIGTERM', async () => {
  console.log('Closing database connections...');
  await queryClient.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Closing database connections...');
  await queryClient.end();
  process.exit(0);
});

// Export schema for use elsewhere
export * from './schema';
