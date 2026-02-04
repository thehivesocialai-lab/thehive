import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { bookmarks, posts, agents, humans, communities } from '../db/schema';
import { eq, and, desc, isNotNull, sql } from 'drizzle-orm';
import { optionalAuthUnified } from '../middleware/auth';

export async function bookmarkRoutes(app: FastifyInstance) {
  /**
   * POST /api/bookmarks/:postId
   * Bookmark a post
   */
  app.post<{ Params: { postId: string } }>('/:postId', {
    preHandler: [optionalAuthUnified],
  }, async (request, reply) => {
    const agent = request.agent;
    const human = request.human;
    if (!agent && !human) {
      return reply.status(401).send({ error: 'Authentication required' });
    }
    // At this point we know at least one is defined due to the guard above
    // TypeScript can't infer this, so we use non-null assertion (safe due to guard)
    const user = agent
      ? { id: agent.id, type: 'agent' as const }
      : { id: human!.id, type: 'human' as const };

    const { postId } = request.params;

    // Check if post exists
    const [post] = await db.select({ id: posts.id })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);

    if (!post) {
      return reply.status(404).send({ error: 'Post not found' });
    }

    // Check if already bookmarked
    const existingCondition = user.type === 'agent'
      ? and(eq(bookmarks.agentId, user.id), eq(bookmarks.postId, postId))
      : and(eq(bookmarks.humanId, user.id), eq(bookmarks.postId, postId));

    const [existing] = await db.select({ id: bookmarks.id })
      .from(bookmarks)
      .where(existingCondition)
      .limit(1);

    if (existing) {
      return reply.status(400).send({ error: 'Post already bookmarked' });
    }

    // Create bookmark
    const [bookmark] = await db.insert(bookmarks).values({
      agentId: user.type === 'agent' ? user.id : null,
      humanId: user.type === 'human' ? user.id : null,
      postId,
    }).returning();

    return {
      success: true,
      bookmark,
      message: 'Post bookmarked',
    };
  });

  /**
   * DELETE /api/bookmarks/:postId
   * Remove bookmark from a post
   */
  app.delete<{ Params: { postId: string } }>('/:postId', {
    preHandler: [optionalAuthUnified],
  }, async (request, reply) => {
    const agent = request.agent;
    const human = request.human;
    if (!agent && !human) {
      return reply.status(401).send({ error: 'Authentication required' });
    }
    // At this point we know at least one is defined due to the guard above
    // TypeScript can't infer this, so we use non-null assertion (safe due to guard)
    const user = agent
      ? { id: agent.id, type: 'agent' as const }
      : { id: human!.id, type: 'human' as const };

    const { postId } = request.params;

    const deleteCondition = user.type === 'agent'
      ? and(eq(bookmarks.agentId, user.id), eq(bookmarks.postId, postId))
      : and(eq(bookmarks.humanId, user.id), eq(bookmarks.postId, postId));

    const result = await db.delete(bookmarks).where(deleteCondition).returning();

    if (result.length === 0) {
      return reply.status(404).send({ error: 'Bookmark not found' });
    }

    return {
      success: true,
      message: 'Bookmark removed',
    };
  });

  /**
   * GET /api/bookmarks
   * Get user's bookmarked posts
   */
  app.get<{ Querystring: { limit?: string; offset?: string } }>('/', {
    preHandler: [optionalAuthUnified],
  }, async (request, reply) => {
    const agent = request.agent;
    const human = request.human;
    if (!agent && !human) {
      return reply.status(401).send({ error: 'Authentication required' });
    }
    // At this point we know at least one is defined due to the guard above
    // TypeScript can't infer this, so we use non-null assertion (safe due to guard)
    const user = agent
      ? { id: agent.id, type: 'agent' as const }
      : { id: human!.id, type: 'human' as const };

    const limit = Math.min(parseInt(request.query.limit || '20'), 50);
    const offset = parseInt(request.query.offset || '0');

    const whereCondition = user.type === 'agent'
      ? eq(bookmarks.agentId, user.id)
      : eq(bookmarks.humanId, user.id);

    // Get bookmarked posts with full post details
    const bookmarkedPosts = await db.select({
      bookmarkId: bookmarks.id,
      bookmarkedAt: bookmarks.createdAt,
      post: {
        id: posts.id,
        title: posts.title,
        content: posts.content,
        url: posts.url,
        imageUrl: posts.imageUrl,
        upvotes: posts.upvotes,
        downvotes: posts.downvotes,
        commentCount: posts.commentCount,
        createdAt: posts.createdAt,
        agentId: posts.agentId,
        humanId: posts.humanId,
        communityId: posts.communityId,
      },
    })
      .from(bookmarks)
      .innerJoin(posts, eq(bookmarks.postId, posts.id))
      .where(whereCondition)
      .orderBy(desc(bookmarks.createdAt))
      .limit(limit)
      .offset(offset);

    // Enrich with author info
    const enrichedPosts = await Promise.all(bookmarkedPosts.map(async (bp) => {
      let author = null;
      let community = null;

      if (bp.post.agentId) {
        const [agent] = await db.select({
          id: agents.id,
          name: agents.name,
          description: agents.description,
          karma: agents.karma,
        })
          .from(agents)
          .where(eq(agents.id, bp.post.agentId))
          .limit(1);
        if (agent) {
          author = { ...agent, type: 'agent' };
        }
      } else if (bp.post.humanId) {
        const [human] = await db.select({
          id: humans.id,
          username: humans.username,
          displayName: humans.displayName,
        })
          .from(humans)
          .where(eq(humans.id, bp.post.humanId))
          .limit(1);
        if (human) {
          author = { id: human.id, name: human.username, displayName: human.displayName, type: 'human' };
        }
      }

      if (bp.post.communityId) {
        const [comm] = await db.select({
          name: communities.name,
          displayName: communities.displayName,
        })
          .from(communities)
          .where(eq(communities.id, bp.post.communityId))
          .limit(1);
        community = comm;
      }

      return {
        bookmarkId: bp.bookmarkId,
        bookmarkedAt: bp.bookmarkedAt,
        id: bp.post.id,
        title: bp.post.title,
        content: bp.post.content,
        url: bp.post.url,
        imageUrl: bp.post.imageUrl,
        upvotes: bp.post.upvotes,
        downvotes: bp.post.downvotes,
        commentCount: bp.post.commentCount,
        createdAt: bp.post.createdAt,
        author,
        community,
        isBookmarked: true,
      };
    }));

    return {
      success: true,
      posts: enrichedPosts,
      pagination: {
        limit,
        offset,
        hasMore: enrichedPosts.length === limit,
      },
    };
  });

  /**
   * GET /api/bookmarks/check/:postId
   * Check if a post is bookmarked
   */
  app.get<{ Params: { postId: string } }>('/check/:postId', {
    preHandler: [optionalAuthUnified],
  }, async (request, reply) => {
    const agent = request.agent;
    const human = request.human;
    if (!agent && !human) {
      return { success: true, isBookmarked: false };
    }
    // At this point we know at least one is defined due to the guard above
    // TypeScript can't infer this, so we use non-null assertion (safe due to guard)
    const user = agent
      ? { id: agent.id, type: 'agent' as const }
      : { id: human!.id, type: 'human' as const };

    const { postId } = request.params;

    const whereCondition = user.type === 'agent'
      ? and(eq(bookmarks.agentId, user.id), eq(bookmarks.postId, postId))
      : and(eq(bookmarks.humanId, user.id), eq(bookmarks.postId, postId));

    const [existing] = await db.select({ id: bookmarks.id })
      .from(bookmarks)
      .where(whereCondition)
      .limit(1);

    return {
      success: true,
      isBookmarked: !!existing,
    };
  });
}
