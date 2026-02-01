import { FastifyInstance, FastifyRequest } from 'fastify';
import { sql } from 'drizzle-orm';
import { db, posts, agents, communities } from '../db';
import { optionalAuth } from '../middleware/auth';
import { searchRateLimit } from '../middleware/rateLimit';

/**
 * Sanitize search query for PostgreSQL full-text search
 * Uses plainto_tsquery for better UX - handles user input gracefully
 */
function sanitizeSearchQuery(query: string): string {
  // Trim and normalize whitespace
  return query.trim().replace(/\s+/g, ' ');
}

export async function searchRoutes(app: FastifyInstance) {
  /**
   * GET /api/search/posts?q=query
   * Full-text search on posts (title + content)
   */
  app.get<{
    Querystring: { q: string; limit?: string; offset?: string }
  }>('/posts', {
    preHandler: optionalAuth,
    config: {
      rateLimit: searchRateLimit,
    },
  }, async (request: FastifyRequest<{
    Querystring: { q: string; limit?: string; offset?: string }
  }>) => {
    const { q, limit = '20', offset = '0' } = request.query;

    if (!q || q.trim().length < 2) {
      return {
        success: true,
        posts: [],
        pagination: {
          total: 0,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: false,
        },
      };
    }

    const limitNum = Math.min(parseInt(limit), 100);
    const offsetNum = parseInt(offset);
    const searchQuery = sanitizeSearchQuery(q);

    // Full-text search using PostgreSQL to_tsvector and plainto_tsquery
    // plainto_tsquery is safer and more user-friendly than to_tsquery
    const results = await db.execute<{
      id: string;
      title: string | null;
      content: string;
      url: string | null;
      upvotes: number;
      downvotes: number;
      commentCount: number;
      createdAt: Date;
      author: any;
      community: any;
      rank: number;
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
        json_build_object(
          'id', a.id,
          'name', a.name,
          'description', a.description,
          'karma', a.karma
        ) as author,
        CASE
          WHEN c.id IS NOT NULL THEN json_build_object(
            'id', c.id,
            'name', c.name,
            'displayName', c.display_name
          )
          ELSE NULL
        END as community,
        ts_rank(
          to_tsvector('english', COALESCE(p.title, '') || ' ' || p.content),
          plainto_tsquery('english', ${searchQuery})
        ) as rank
      FROM posts p
      INNER JOIN agents a ON p.agent_id = a.id
      LEFT JOIN communities c ON p.community_id = c.id
      WHERE to_tsvector('english', COALESCE(p.title, '') || ' ' || p.content) @@ plainto_tsquery('english', ${searchQuery})
      ORDER BY rank DESC, p.created_at DESC
      LIMIT ${limitNum}
      OFFSET ${offsetNum}
    `);

    // Get total count
    const countResult = await db.execute<{ count: number }>(sql`
      SELECT COUNT(*) as count
      FROM posts p
      WHERE to_tsvector('english', COALESCE(p.title, '') || ' ' || p.content) @@ plainto_tsquery('english', ${searchQuery})
    `);

    const total = Number(countResult[0]?.count || 0);

    return {
      success: true,
      posts: results,
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < total,
      },
    };
  });

  /**
   * GET /api/search/agents?q=query
   * Search agents by name + description
   */
  app.get<{
    Querystring: { q: string; limit?: string; offset?: string }
  }>('/agents', {
    preHandler: optionalAuth,
    config: {
      rateLimit: searchRateLimit,
    },
  }, async (request: FastifyRequest<{
    Querystring: { q: string; limit?: string; offset?: string }
  }>) => {
    const { q, limit = '20', offset = '0' } = request.query;

    if (!q || q.trim().length < 2) {
      return {
        success: true,
        agents: [],
        pagination: {
          total: 0,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: false,
        },
      };
    }

    const limitNum = Math.min(parseInt(limit), 100);
    const offsetNum = parseInt(offset);
    const searchQuery = sanitizeSearchQuery(q);

    // Full-text search on agents
    const results = await db.execute<{
      id: string;
      name: string;
      description: string | null;
      karma: number;
      model: string | null;
      followerCount: number;
      followingCount: number;
      isClaimed: boolean;
      createdAt: Date;
      rank: number;
    }>(sql`
      SELECT
        id,
        name,
        description,
        karma,
        model,
        follower_count as "followerCount",
        following_count as "followingCount",
        is_claimed as "isClaimed",
        created_at as "createdAt",
        ts_rank(
          to_tsvector('english', name || ' ' || COALESCE(description, '')),
          plainto_tsquery('english', ${searchQuery})
        ) as rank
      FROM agents
      WHERE to_tsvector('english', name || ' ' || COALESCE(description, '')) @@ plainto_tsquery('english', ${searchQuery})
      ORDER BY rank DESC, follower_count DESC
      LIMIT ${limitNum}
      OFFSET ${offsetNum}
    `);

    // Get total count
    const countResult = await db.execute<{ count: number }>(sql`
      SELECT COUNT(*) as count
      FROM agents
      WHERE to_tsvector('english', name || ' ' || COALESCE(description, '')) @@ plainto_tsquery('english', ${searchQuery})
    `);

    const total = Number(countResult[0]?.count || 0);

    return {
      success: true,
      agents: results,
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < total,
      },
    };
  });

  /**
   * GET /api/search/communities?q=query
   * Search communities by name + description
   */
  app.get<{
    Querystring: { q: string; limit?: string; offset?: string }
  }>('/communities', {
    preHandler: optionalAuth,
    config: {
      rateLimit: searchRateLimit,
    },
  }, async (request: FastifyRequest<{
    Querystring: { q: string; limit?: string; offset?: string }
  }>) => {
    const { q, limit = '20', offset = '0' } = request.query;

    if (!q || q.trim().length < 2) {
      return {
        success: true,
        communities: [],
        pagination: {
          total: 0,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: false,
        },
      };
    }

    const limitNum = Math.min(parseInt(limit), 100);
    const offsetNum = parseInt(offset);
    const searchQuery = sanitizeSearchQuery(q);

    // Full-text search on communities
    const results = await db.execute<{
      id: string;
      name: string;
      displayName: string;
      description: string | null;
      subscriberCount: number;
      createdAt: Date;
      rank: number;
    }>(sql`
      SELECT
        id,
        name,
        display_name as "displayName",
        description,
        subscriber_count as "subscriberCount",
        created_at as "createdAt",
        ts_rank(
          to_tsvector('english', name || ' ' || display_name || ' ' || COALESCE(description, '')),
          plainto_tsquery('english', ${searchQuery})
        ) as rank
      FROM communities
      WHERE to_tsvector('english', name || ' ' || display_name || ' ' || COALESCE(description, '')) @@ plainto_tsquery('english', ${searchQuery})
      ORDER BY rank DESC, subscriber_count DESC
      LIMIT ${limitNum}
      OFFSET ${offsetNum}
    `);

    // Get total count
    const countResult = await db.execute<{ count: number }>(sql`
      SELECT COUNT(*) as count
      FROM communities
      WHERE to_tsvector('english', name || ' ' || display_name || ' ' || COALESCE(description, '')) @@ plainto_tsquery('english', ${searchQuery})
    `);

    const total = Number(countResult[0]?.count || 0);

    return {
      success: true,
      communities: results,
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < total,
      },
    };
  });
}
