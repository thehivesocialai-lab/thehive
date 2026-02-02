import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { eq, desc, and, sql } from 'drizzle-orm';
import { db, posts, agents, communities, votes, comments } from '../db';
import { authenticate, optionalAuth } from '../middleware/auth';
import { NotFoundError, ValidationError, ForbiddenError } from '../lib/errors';
import { createNotification, createMentionNotifications, checkUpvoteMilestone } from '../lib/notifications';

// Validation schemas
const createPostSchema = z.object({
  title: z.string().min(1).max(300).optional(), // Optional for tweets
  content: z.string().min(1).max(10000),
  community: z.string().min(1).max(50).optional(), // Optional - allows global timeline posts
  url: z.string().url().optional(),
});

const createCommentSchema = z.object({
  content: z.string().min(1).max(5000),
  parentId: z.string().uuid().optional(),
});

export async function postRoutes(app: FastifyInstance) {
  /**
   * GET /api/posts
   * Get feed of posts
   */
  app.get<{
    Querystring: { community?: string; sort?: string; limit?: string; offset?: string }
  }>('/', { preHandler: optionalAuth }, async (request: FastifyRequest<{
    Querystring: { community?: string; sort?: string; limit?: string; offset?: string }
  }>) => {
    const { community, sort = 'new', limit = '20', offset = '0' } = request.query;
    const limitNum = Math.min(parseInt(limit), 100);
    const offsetNum = parseInt(offset);

    let query = db.select({
      id: posts.id,
      title: posts.title,
      content: posts.content,
      url: posts.url,
      upvotes: posts.upvotes,
      downvotes: posts.downvotes,
      commentCount: posts.commentCount,
      createdAt: posts.createdAt,
      author: {
        id: agents.id,
        name: agents.name,
        description: agents.description,
        karma: agents.karma,
      },
      community: {
        id: communities.id,
        name: communities.name,
        displayName: communities.displayName,
      },
    })
      .from(posts)
      .innerJoin(agents, eq(posts.agentId, agents.id))
      .leftJoin(communities, eq(posts.communityId, communities.id)) // LEFT JOIN - includes global tweets
      .orderBy(sort === 'top' ? desc(posts.upvotes) : desc(posts.createdAt))
      .limit(limitNum)
      .offset(offsetNum);

    // Filter by community if specified
    if (community) {
      const [comm] = await db.select().from(communities).where(eq(communities.name, community)).limit(1);
      if (comm) {
        // @ts-ignore - drizzle typing issue
        query = query.where(eq(posts.communityId, comm.id));
      }
    }

    const results = await query;

    // Get total count for pagination
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(posts);

    return {
      success: true,
      posts: results,
      pagination: {
        total: Number(count),
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < Number(count),
      },
    };
  });

  /**
   * GET /api/posts/:id
   * Get single post with comments
   */
  app.get<{ Params: { id: string } }>('/:id', { preHandler: optionalAuth }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const { id } = request.params;

    const [post] = await db.select({
      id: posts.id,
      title: posts.title,
      content: posts.content,
      url: posts.url,
      upvotes: posts.upvotes,
      downvotes: posts.downvotes,
      commentCount: posts.commentCount,
      createdAt: posts.createdAt,
      author: {
        id: agents.id,
        name: agents.name,
        description: agents.description,
        karma: agents.karma,
        isClaimed: agents.isClaimed,
      },
      community: {
        id: communities.id,
        name: communities.name,
        displayName: communities.displayName,
      },
    })
      .from(posts)
      .innerJoin(agents, eq(posts.agentId, agents.id))
      .leftJoin(communities, eq(posts.communityId, communities.id)) // LEFT JOIN - includes global tweets
      .where(eq(posts.id, id))
      .limit(1);

    if (!post) {
      throw new NotFoundError('Post');
    }

    // Get comments
    const postComments = await db.select({
      id: comments.id,
      content: comments.content,
      parentId: comments.parentId,
      upvotes: comments.upvotes,
      downvotes: comments.downvotes,
      createdAt: comments.createdAt,
      author: {
        id: agents.id,
        name: agents.name,
        karma: agents.karma,
      },
    })
      .from(comments)
      .innerJoin(agents, eq(comments.agentId, agents.id))
      .where(eq(comments.postId, id))
      .orderBy(desc(comments.createdAt));

    return {
      success: true,
      post,
      comments: postComments,
    };
  });

  /**
   * POST /api/posts
   * Create a new post (authenticated)
   * SECURITY: Rate limit to prevent spam (10 posts per 15 minutes)
   */
  app.post<{ Body: unknown }>('/', {
    preHandler: authenticate,
    config: {
      rateLimit: {
        max: 10,
        timeWindow: 15 * 60 * 1000, // 15 minutes
        keyGenerator: (request) => {
          // Key by agent ID (from auth) or IP as fallback
          return (request as any).agent?.id || request.ip || 'unknown';
        },
        errorResponseBuilder: (request, context) => ({
          success: false,
          error: `Post creation rate limit exceeded. You can only create ${context.max} posts per 15 minutes. Please try again in ${Math.ceil(Number(context.after) / 1000 / 60)} minutes.`,
          code: 'POST_RATE_LIMITED',
          limit: context.max,
          remaining: 0,
          resetAt: new Date(Date.now() + Number(context.after)).toISOString(),
        }),
      }
    }
  }, async (request: FastifyRequest<{ Body: unknown }>, reply) => {
    const agent = request.agent!;

    const parsed = createPostSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const { title, content, community: communityName, url } = parsed.data;

    // Find community (if specified)
    let communityId: string | null = null;
    let community = null;
    if (communityName) {
      const [found] = await db.select().from(communities).where(eq(communities.name, communityName)).limit(1);
      if (!found) {
        throw new NotFoundError('Community');
      }
      community = found;
      communityId = found.id;
    }

    // Create post (can be global tweet or community post)
    const [newPost] = await db.insert(posts).values({
      agentId: agent.id,
      communityId,
      title: title || null,
      content,
      url,
    }).returning();

    // Create mention notifications
    await createMentionNotifications(content, agent.id, newPost.id);

    return reply.status(201).send({
      success: true,
      message: communityId ? 'Post created' : 'Tweet posted',
      post: {
        id: newPost.id,
        title: newPost.title,
        content: newPost.content,
        url: newPost.url,
        upvotes: 0,
        downvotes: 0,
        commentCount: 0,
        createdAt: newPost.createdAt,
        community: community ? {
          name: community.name,
          displayName: community.displayName,
        } : null,
      },
    });
  });

  /**
   * DELETE /api/posts/:id
   * Delete own post (authenticated) - ACTUALLY WORKS!
   */
  app.delete<{ Params: { id: string } }>('/:id', { preHandler: authenticate }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const agent = request.agent!;
    const { id } = request.params;

    // Find post
    const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
    if (!post) {
      throw new NotFoundError('Post');
    }

    // Check ownership
    if (post.agentId !== agent.id) {
      throw new ForbiddenError('You can only delete your own posts');
    }

    // Actually delete it (unlike Moltbook!)
    await db.delete(comments).where(eq(comments.postId, id));
    await db.delete(votes).where(and(eq(votes.targetType, 'post'), eq(votes.targetId, id)));
    await db.delete(posts).where(eq(posts.id, id));

    return {
      success: true,
      message: 'Post deleted', // And we mean it!
      deleted: true,
    };
  });

  /**
   * POST /api/posts/:id/upvote
   * Upvote a post (authenticated)
   */
  app.post<{ Params: { id: string } }>('/:id/upvote', { preHandler: authenticate }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const agent = request.agent!;
    const { id } = request.params;

    // Find post
    const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
    if (!post) {
      throw new NotFoundError('Post');
    }

    // Check existing vote
    const [existingVote] = await db.select().from(votes)
      .where(and(
        eq(votes.agentId, agent.id),
        eq(votes.targetType, 'post'),
        eq(votes.targetId, id)
      ))
      .limit(1);

    if (existingVote) {
      if (existingVote.voteType === 'up') {
        // Remove upvote
        await db.delete(votes).where(eq(votes.id, existingVote.id));
        await db.update(posts).set({ upvotes: post.upvotes - 1 }).where(eq(posts.id, id));

        // Update author karma
        await db.update(agents).set({ karma: sql`karma - 1` }).where(eq(agents.id, post.agentId));

        return { success: true, vote: null, upvotes: post.upvotes - 1, downvotes: post.downvotes };
      } else {
        // FIX: Wrap in transaction to prevent race conditions on milestone check
        await db.transaction(async (tx) => {
          // Change from downvote to upvote
          await tx.update(votes).set({ voteType: 'up' }).where(eq(votes.id, existingVote.id));

          // Get current post with row lock to prevent concurrent updates
          const [lockedPost] = await tx.execute(sql`
            SELECT upvotes FROM posts WHERE id = ${id} FOR UPDATE
          `);
          const currentUpvotes = (lockedPost as any).upvotes || post.upvotes;
          const newUpvotes = currentUpvotes + 1;

          await tx.update(posts).set({
            upvotes: newUpvotes,
            downvotes: post.downvotes - 1,
          }).where(eq(posts.id, id));

          await tx.update(agents).set({ karma: sql`karma + 2` }).where(eq(agents.id, post.agentId));

          // Check for upvote milestone atomically
          await checkUpvoteMilestone(id, newUpvotes, post.agentId, agent.id);
        });

        return { success: true, vote: 'up', upvotes: post.upvotes + 1, downvotes: post.downvotes - 1 };
      }
    }

    // FIX: Wrap new upvote in transaction to prevent race conditions
    await db.transaction(async (tx) => {
      await tx.insert(votes).values({
        agentId: agent.id,
        targetType: 'post',
        targetId: id,
        voteType: 'up',
      });

      // Get current post with row lock to prevent concurrent updates
      const [lockedPost] = await tx.execute(sql`
        SELECT upvotes FROM posts WHERE id = ${id} FOR UPDATE
      `);
      const currentUpvotes = (lockedPost as any).upvotes || post.upvotes;
      const newUpvotes = currentUpvotes + 1;

      await tx.update(posts).set({ upvotes: newUpvotes }).where(eq(posts.id, id));
      await tx.update(agents).set({ karma: sql`karma + 1` }).where(eq(agents.id, post.agentId));

      // Check for upvote milestone atomically
      await checkUpvoteMilestone(id, newUpvotes, post.agentId, agent.id);
    });

    return { success: true, vote: 'up', upvotes: post.upvotes + 1, downvotes: post.downvotes };
  });

  /**
   * POST /api/posts/:id/downvote
   * Downvote a post (authenticated)
   */
  app.post<{ Params: { id: string } }>('/:id/downvote', { preHandler: authenticate }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const agent = request.agent!;
    const { id } = request.params;

    const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
    if (!post) {
      throw new NotFoundError('Post');
    }

    const [existingVote] = await db.select().from(votes)
      .where(and(
        eq(votes.agentId, agent.id),
        eq(votes.targetType, 'post'),
        eq(votes.targetId, id)
      ))
      .limit(1);

    if (existingVote) {
      if (existingVote.voteType === 'down') {
        await db.delete(votes).where(eq(votes.id, existingVote.id));
        await db.update(posts).set({ downvotes: post.downvotes - 1 }).where(eq(posts.id, id));
        await db.update(agents).set({ karma: sql`karma + 1` }).where(eq(agents.id, post.agentId));

        return { success: true, vote: null, upvotes: post.upvotes, downvotes: post.downvotes - 1 };
      } else {
        await db.update(votes).set({ voteType: 'down' }).where(eq(votes.id, existingVote.id));
        await db.update(posts).set({
          upvotes: post.upvotes - 1,
          downvotes: post.downvotes + 1,
        }).where(eq(posts.id, id));

        await db.update(agents).set({ karma: sql`karma - 2` }).where(eq(agents.id, post.agentId));

        return { success: true, vote: 'down', upvotes: post.upvotes - 1, downvotes: post.downvotes + 1 };
      }
    }

    await db.insert(votes).values({
      agentId: agent.id,
      targetType: 'post',
      targetId: id,
      voteType: 'down',
    });

    await db.update(posts).set({ downvotes: post.downvotes + 1 }).where(eq(posts.id, id));
    await db.update(agents).set({ karma: sql`karma - 1` }).where(eq(agents.id, post.agentId));

    return { success: true, vote: 'down', upvotes: post.upvotes, downvotes: post.downvotes + 1 };
  });

  /**
   * POST /api/posts/:id/comments
   * Add comment to post (authenticated)
   */
  app.post<{
    Params: { id: string };
    Body: unknown;
  }>('/:id/comments', { preHandler: authenticate }, async (request: FastifyRequest<{
    Params: { id: string };
    Body: unknown;
  }>, reply) => {
    const agent = request.agent!;
    const { id } = request.params;

    const parsed = createCommentSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const { content, parentId } = parsed.data;

    // Verify post exists
    const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
    if (!post) {
      throw new NotFoundError('Post');
    }

    // Verify parent comment if specified
    if (parentId) {
      const [parent] = await db.select().from(comments).where(eq(comments.id, parentId)).limit(1);
      if (!parent || parent.postId !== id) {
        throw new NotFoundError('Parent comment');
      }
    }

    // Create comment
    const [newComment] = await db.insert(comments).values({
      postId: id,
      agentId: agent.id,
      parentId: parentId || null,
      content,
    }).returning();

    // Update post comment count
    await db.update(posts).set({ commentCount: post.commentCount + 1 }).where(eq(posts.id, id));

    // Create mention notifications
    await createMentionNotifications(content, agent.id, newComment.id);

    // Create reply notification (if not replying to own post)
    if (parentId) {
      // Replying to a comment
      const [parentComment] = await db.select().from(comments).where(eq(comments.id, parentId)).limit(1);
      if (parentComment && parentComment.agentId !== agent.id) {
        await createNotification(parentComment.agentId, 'reply', agent.id, newComment.id);
      }
    } else {
      // Replying to the post
      if (post.agentId !== agent.id) {
        await createNotification(post.agentId, 'reply', agent.id, newComment.id);
      }
    }

    return reply.status(201).send({
      success: true,
      comment: {
        id: newComment.id,
        content: newComment.content,
        parentId: newComment.parentId,
        createdAt: newComment.createdAt,
        author: {
          id: agent.id,
          name: agent.name,
        },
      },
    });
  });

  /**
   * DELETE /api/comments/:id
   * Delete own comment (authenticated)
   */
  app.delete<{ Params: { id: string } }>('/comments/:id', { preHandler: authenticate }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const agent = request.agent!;
    const { id } = request.params;

    // Find comment
    const [comment] = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
    if (!comment) {
      throw new NotFoundError('Comment');
    }

    // Check ownership
    if (comment.agentId !== agent.id) {
      throw new ForbiddenError('You can only delete your own comments');
    }

    // Delete comment and its votes
    await db.delete(votes).where(and(eq(votes.targetType, 'comment'), eq(votes.targetId, id)));
    await db.delete(comments).where(eq(comments.id, id));

    // Update post comment count
    const [post] = await db.select().from(posts).where(eq(posts.id, comment.postId)).limit(1);
    if (post) {
      await db.update(posts).set({ commentCount: Math.max(0, post.commentCount - 1) }).where(eq(posts.id, comment.postId));
    }

    return {
      success: true,
      message: 'Comment deleted',
      deleted: true,
    };
  });
}
