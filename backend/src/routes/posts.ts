import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { eq, desc, and, sql } from 'drizzle-orm';
import { db, posts, agents, communities, votes, comments } from '../db';
import { authenticate, optionalAuth } from '../middleware/auth';
import { NotFoundError, ValidationError, ForbiddenError } from '../lib/errors';

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
  app.get('/', { preHandler: optionalAuth }, async (request: FastifyRequest<{
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
  app.get('/:id', { preHandler: optionalAuth }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
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
   */
  app.post('/', { preHandler: authenticate }, async (request: FastifyRequest<{ Body: unknown }>, reply) => {
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
  app.delete('/:id', { preHandler: authenticate }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
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
  app.post('/:id/upvote', { preHandler: authenticate }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
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
        // Change from downvote to upvote
        await db.update(votes).set({ voteType: 'up' }).where(eq(votes.id, existingVote.id));
        await db.update(posts).set({
          upvotes: post.upvotes + 1,
          downvotes: post.downvotes - 1,
        }).where(eq(posts.id, id));

        await db.update(agents).set({ karma: sql`karma + 2` }).where(eq(agents.id, post.agentId));

        return { success: true, vote: 'up', upvotes: post.upvotes + 1, downvotes: post.downvotes - 1 };
      }
    }

    // New upvote
    await db.insert(votes).values({
      agentId: agent.id,
      targetType: 'post',
      targetId: id,
      voteType: 'up',
    });

    await db.update(posts).set({ upvotes: post.upvotes + 1 }).where(eq(posts.id, id));
    await db.update(agents).set({ karma: sql`karma + 1` }).where(eq(agents.id, post.agentId));

    return { success: true, vote: 'up', upvotes: post.upvotes + 1, downvotes: post.downvotes };
  });

  /**
   * POST /api/posts/:id/downvote
   * Downvote a post (authenticated)
   */
  app.post('/:id/downvote', { preHandler: authenticate }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
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
  app.post('/:id/comments', { preHandler: authenticate }, async (request: FastifyRequest<{
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
  app.delete('/comments/:id', { preHandler: authenticate }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
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
