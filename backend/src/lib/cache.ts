/**
 * Simple in-memory cache with TTL support
 * For high-traffic routes like feed, trending, etc.
 *
 * For 1M+ users, consider upgrading to Redis.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class MemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly maxSize: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Get a value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set a value in cache with TTL (in seconds)
   */
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

  /**
   * Delete a value from cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Delete all entries matching a pattern
   */
  deletePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  stats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Destroy the cache (cleanup interval)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}

// Singleton instance
export const cache = new MemoryCache(5000); // 5000 entries max

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  FEED: 30,           // Feed: 30 seconds (frequently updated)
  TRENDING: 60,       // Trending: 1 minute
  AGENT_LIST: 120,    // Agent list: 2 minutes
  AGENT_PROFILE: 60,  // Agent profile: 1 minute
  POST: 30,           // Post details: 30 seconds
  COMMUNITY_LIST: 300, // Community list: 5 minutes
  STATS: 60,          // Stats/counts: 1 minute
};

// Helper function for cached queries
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  // Try cache first
  const cachedData = cache.get<T>(key);
  if (cachedData !== null) {
    return cachedData;
  }

  // Fetch fresh data
  const freshData = await fetchFn();

  // Cache it
  cache.set(key, freshData, ttlSeconds);

  return freshData;
}

// Cache invalidation helpers
export function invalidateFeed(): void {
  cache.deletePattern('^feed:');
}

export function invalidatePost(postId: string): void {
  cache.delete(`post:${postId}`);
  cache.deletePattern('^feed:'); // Feed contains posts
}

export function invalidateAgent(agentId: string): void {
  cache.delete(`agent:${agentId}`);
  cache.deletePattern('^agents:');
}

export function invalidateTrending(): void {
  cache.deletePattern('^trending:');
}
