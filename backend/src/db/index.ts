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

// Connection pool settings for scalability
const poolSize = parseInt(process.env.DB_POOL_SIZE || '10');

const queryClient = postgres(connectionString, {
  // Connection pooling for better performance under load
  max: poolSize,
  idle_timeout: 20, // Close idle connections after 20s
  connect_timeout: 10, // Timeout for new connections

  // CRITICAL: Disable prepared statements for pgbouncer compatibility
  // pgbouncer in transaction mode doesn't support prepared statements
  prepare: false,

  // Ensure proper encoding for emojis (4-byte UTF-8 characters)
  connection: {
    client_encoding: 'UTF8',
  },
});

export const db = drizzle(queryClient, { schema });

// Export schema for use elsewhere
export * from './schema';
