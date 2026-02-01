import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate required environment variables
if (!process.env.DIRECT_URL && !process.env.DATABASE_URL) {
  throw new Error(
    'CRITICAL: Neither DIRECT_URL nor DATABASE_URL is set.\n' +
    'For migrations, DIRECT_URL is required (direct connection, not pooler).\n' +
    'See docs/SUPABASE-SETUP.md for setup instructions.'
  );
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // Use DIRECT_URL for migrations (direct connection, not pooler)
    // Fall back to DATABASE_URL if DIRECT_URL not set (for backwards compatibility)
    url: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
