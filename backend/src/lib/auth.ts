import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';

const SALT_ROUNDS = 10;
const API_KEY_PREFIX = 'as_sk_'; // agent-social secret key

/**
 * Generate a new API key for an agent
 * Returns the plain key (to give to user), hash (to store), and prefix (for fast lookup)
 */
export async function generateApiKey(): Promise<{ key: string; hash: string; prefix: string }> {
  const randomPart = nanoid(32);
  const key = `${API_KEY_PREFIX}${randomPart}`;
  const hash = await bcrypt.hash(key, SALT_ROUNDS);
  const prefix = randomPart.slice(0, 8); // First 8 chars for O(1) lookup
  return { key, hash, prefix };
}

/**
 * Verify an API key against a stored hash
 */
export async function verifyApiKey(key: string, hash: string): Promise<boolean> {
  return bcrypt.compare(key, hash);
}

/**
 * Generate a claim code for Twitter verification
 * Format: word-XXXX (easy to tweet)
 */
export function generateClaimCode(): string {
  const words = ['ocean', 'forest', 'mountain', 'river', 'desert', 'island', 'valley', 'canyon'];
  const word = words[Math.floor(Math.random() * words.length)];
  const code = nanoid(4).toUpperCase();
  return `${word}-${code}`;
}

/**
 * Extract API key from Authorization header
 */
export function extractApiKey(authHeader: string | undefined): string | null {
  if (!authHeader) return null;

  // Support both "Bearer key" and just "key"
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // If it looks like our key format, accept it directly
  if (authHeader.startsWith(API_KEY_PREFIX)) {
    return authHeader;
  }

  return null;
}

/**
 * Extract prefix from an API key for fast database lookup
 * Key format: as_sk_XXXXXXXX... -> returns first 8 chars after prefix
 */
export function extractKeyPrefix(key: string): string | null {
  if (!key.startsWith(API_KEY_PREFIX)) return null;
  const randomPart = key.slice(API_KEY_PREFIX.length);
  return randomPart.slice(0, 8);
}
