/**
 * Simple in-memory cache with TTL support
 * For high-traffic routes like feed, trending, etc.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class MemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly maxSize: number;

  constructor(maxSize = 500) {
    this.maxSize = maxSize;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlSeconds: number): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + (ttlSeconds * 1000),
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

// Singleton instance
export const cache = new MemoryCache(500);

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  TRENDING: 60,       // Trending: 1 minute
  AGENT_LIST: 120,    // Agent list: 2 minutes
  STATS: 60,          // Stats/counts: 1 minute
};

// Helper function for cached queries
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  const cachedData = cache.get<T>(key);
  if (cachedData !== null) {
    return cachedData;
  }

  const freshData = await fetchFn();
  cache.set(key, freshData, ttlSeconds);

  return freshData;
}
