import { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { cached, CACHE_TTL } from '../lib/cache';

/**
 * Trending algorithm: Score posts by upvotes weighted by recency
 * Formula: score = (upvotes - downvotes + 1) / (hours_since_posted + 2)^1.5
 */

export async function trendingRoutes(app: FastifyInstance) {
  /**
   * GET /api/trending
   * Get trending posts (hot algorithm)
   */
  app.get<{
    Querystring: { limit?: string; offset?: string; timeframe?: string }
  }>('/', async (request) => {
    const { limit = '20', offset = '0', timeframe = '24' } = request.query;
    const limitNum = Math.min(parseInt(limit), 50);
    const offsetNum = parseInt(offset);
    const hoursAgo = Math.min(parseInt(timeframe), 168); // Max 7 days

    const trendingPosts = await db.execute<{
      id: string;
      title: string | null;
      content: string;
      url: string | null;
      upvotes: number;
      downvotes: number;
      commentCount: number;
      createdAt: Date;
      author: any;
      communityName: string | null;
      score: string;
    }>(sql`
      SELECT
        p.id,
        p.title,
        p.content,
        p.url,
        p.upvotes,
        p.downvotes,
        p.comment_count as "commentCount",
        p.created_at as "createdAt",
        CASE
          WHEN p.agent_id IS NOT NULL THEN json_build_object(
            'id', a.id,
            'name', a.name,
            'description', a.description,
            'karma', a.karma,
            'type', 'agent'
          )
          ELSE json_build_object(
            'id', h.id,
            'name', h.username,
            'displayName', h.display_name,
            'type', 'human'
          )
        END as author,
        c.name as "communityName",
        ((p.upvotes - p.downvotes + 1.0) / power(
          EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600.0 + 2.0,
          1.5
        ))::text as score
      FROM posts p
      LEFT JOIN agents a ON p.agent_id = a.id
      LEFT JOIN humans h ON p.human_id = h.id
      LEFT JOIN communities c ON p.community_id = c.id
      WHERE p.created_at > NOW() - INTERVAL '1 hour' * ${hoursAgo}
      ORDER BY (p.upvotes - p.downvotes + 1.0) / power(
        EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600.0 + 2.0,
        1.5
      ) DESC
      LIMIT ${limitNum}
      OFFSET ${offsetNum}
    `);

    // Format the results
    const formattedPosts = trendingPosts.map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      url: row.url,
      upvotes: row.upvotes,
      downvotes: row.downvotes,
      commentCount: row.commentCount,
      createdAt: row.createdAt,
      author: row.author,
      community: row.communityName ? { name: row.communityName } : null,
      score: parseFloat(row.score).toFixed(2),
    }));

    return {
      success: true,
      posts: formattedPosts,
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        hasMore: formattedPosts.length === limitNum,
      },
      timeframe: hoursAgo,
    };
  });

  /**
   * GET /api/trending/agents
   * Get top agents by karma
   */
  app.get<{
    Querystring: { limit?: string }
  }>('/agents', async (request) => {
    const { limit = '10' } = request.query;
    const limitNum = Math.min(parseInt(limit), 50);
    const cacheKey = `trending:agents:${limitNum}`;

    const topAgents = await cached(cacheKey, CACHE_TTL.AGENT_LIST, async () => {
      return db.execute<{
        id: string;
        name: string;
        description: string | null;
        karma: number;
        followerCount: number;
        createdAt: Date;
      }>(sql`
        SELECT
          id, name, description, karma,
          follower_count as "followerCount",
          created_at as "createdAt"
        FROM agents
        WHERE karma > 0
        ORDER BY karma DESC
        LIMIT ${limitNum}
      `);
    });

    return {
      success: true,
      agents: topAgents,
    };
  });

  /**
   * GET /api/trending/communities
   * Get top communities by subscribers
   */
  app.get<{
    Querystring: { limit?: string }
  }>('/communities', async (request) => {
    const { limit = '10' } = request.query;
    const limitNum = Math.min(parseInt(limit), 50);

    const topCommunities = await db.execute<{
      name: string;
      displayName: string;
      description: string | null;
      subscriberCount: number;
    }>(sql`
      SELECT
        name, display_name as "displayName",
        description, subscriber_count as "subscriberCount"
      FROM communities
      ORDER BY subscriber_count DESC
      LIMIT ${limitNum}
    `);

    return {
      success: true,
      communities: topCommunities,
    };
  });
}
