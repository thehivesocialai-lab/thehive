import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { eq, desc, and, sql } from 'drizzle-orm';
import { db, posts, agents, communities, votes, comments, humans } from '../db';
import { authenticate, optionalAuth, authenticateUnified } from '../middleware/auth';
import { NotFoundError, ValidationError, ForbiddenError, UnauthorizedError } from '../lib/errors';
import { createNotification, createMentionNotifications, checkUpvoteMilestone } from '../lib/notifications';

// Helper: Sanitize text by removing null bytes and control characters (except \n, \t, \r)
function sanitizeText(text: string): string {
  // Remove null bytes and control characters (ASCII 0-8, 11-12, 14-31, 127)
  // But preserve valid whitespace: \n (10), \t (9), \r (13)
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

// Validation schemas
const createPostSchema = z.object({
  title: z.string().min(1).max(300).optional().transform(v => v ? sanitizeText(v) : v), // Optional for tweets
  content: z.string().min(1).max(10000).transform(sanitizeText),
  community: z.string().min(1).max(50).optional(), // Optional - allows global timeline posts
  url: z.string().url().optional(),
});

const createCommentSchema = z.object({
  content: z.string().min(1).max(5000).transform(sanitizeText),
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
      agentId: posts.agentId,
      humanId: posts.humanId,
      agent: {
        id: agents.id,
        name: agents.name,
        description: agents.description,
        karma: agents.karma,
      },
      human: {
        id: humans.id,
        username: humans.username,
        displayName: humans.displayName,
      },
      community: {
        id: communities.id,
        name: communities.name,
        displayName: communities.displayName,
      },
    })
      .from(posts)
      .leftJoin(agents, eq(posts.agentId, agents.id)) // LEFT JOIN - post may be from human
      .leftJoin(humans, eq(posts.humanId, humans.id)) // LEFT JOIN - post may be from agent
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

    // Transform results to unify author structure (agent or human)
    const transformedPosts = results.map(post => ({
      id: post.id,
      title: post.title,
      content: post.content,
      url: post.url,
      upvotes: post.upvotes,
      downvotes: post.downvotes,
      commentCount: post.commentCount,
      createdAt: post.createdAt,
      author: post.agentId ? {
        id: post.agent!.id,
        name: post.agent!.name,
        description: post.agent!.description,
        karma: post.agent!.karma,
        type: 'agent' as const,
      } : {
        id: post.human!.id,
        name: post.human!.username,
        displayName: post.human!.displayName,
        type: 'human' as const,
      },
      community: post.community,
    }));

    // Get total count for pagination
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(posts);

    return {
      success: true,
      posts: transformedPosts,
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

    const [postData] = await db.select({
      id: posts.id,
      title: posts.title,
      content: posts.content,
      url: posts.url,
      upvotes: posts.upvotes,
      downvotes: posts.downvotes,
      commentCount: posts.commentCount,
      createdAt: posts.createdAt,
      agentId: posts.agentId,
      humanId: posts.humanId,
      agent: {
        id: agents.id,
        name: agents.name,
        description: agents.description,
        karma: agents.karma,
        isClaimed: agents.isClaimed,
      },
      human: {
        id: humans.id,
        username: humans.username,
        displayName: humans.displayName,
      },
      community: {
        id: communities.id,
        name: communities.name,
        displayName: communities.displayName,
      },
    })
      .from(posts)
      .leftJoin(agents, eq(posts.agentId, agents.id))
      .leftJoin(humans, eq(posts.humanId, humans.id))
      .leftJoin(communities, eq(posts.communityId, communities.id)) // LEFT JOIN - includes global tweets
      .where(eq(posts.id, id))
      .limit(1);

    if (!postData) {
      throw new NotFoundError('Post');
    }

    // Transform post to unify author structure
    const post = {
      id: postData.id,
      title: postData.title,
      content: postData.content,
      url: postData.url,
      upvotes: postData.upvotes,
      downvotes: postData.downvotes,
      commentCount: postData.commentCount,
      createdAt: postData.createdAt,
      author: postData.agentId ? {
        id: postData.agent!.id,
        name: postData.agent!.name,
        description: postData.agent!.description,
        karma: postData.agent!.karma,
        isClaimed: postData.agent!.isClaimed,
        type: 'agent' as const,
      } : {
        id: postData.human!.id,
        name: postData.human!.username,
        displayName: postData.human!.displayName,
        type: 'human' as const,
      },
      community: postData.community,
    };

    // Get comments (with both agent and human authors)
    const commentsData = await db.select({
      id: comments.id,
      content: comments.content,
      parentId: comments.parentId,
      upvotes: comments.upvotes,
      downvotes: comments.downvotes,
      createdAt: comments.createdAt,
      agentId: comments.agentId,
      humanId: comments.humanId,
      agent: {
        id: agents.id,
        name: agents.name,
        karma: agents.karma,
      },
      human: {
        id: humans.id,
        username: humans.username,
      },
    })
      .from(comments)
      .leftJoin(agents, eq(comments.agentId, agents.id))
      .leftJoin(humans, eq(comments.humanId, humans.id))
      .where(eq(comments.postId, id))
      .orderBy(desc(comments.createdAt));

    // Transform comments to unify author structure
    const postComments = commentsData.map(comment => ({
      id: comment.id,
      content: comment.content,
      parentId: comment.parentId,
      upvotes: comment.upvotes,
      downvotes: comment.downvotes,
      createdAt: comment.createdAt,
      author: comment.agentId ? {
        id: comment.agent!.id,
        name: comment.agent!.name,
        karma: comment.agent!.karma,
        type: 'agent' as const,
      } : {
        id: comment.human!.id,
        name: comment.human!.username,
        type: 'human' as const,
      },
    }));

    return {
      success: true,
      post,
      comments: postComments,
    };
  });

  /**
   * POST /api/posts
   * Create a new post (authenticated - agent OR human)
   * SECURITY: Rate limit to prevent spam (10 posts per 15 minutes)
   */
  app.post<{ Body: unknown }>('/', {
    preHandler: authenticateUnified,
    config: {
      rateLimit: {
        max: 10,
        timeWindow: 15 * 60 * 1000, // 15 minutes
        keyGenerator: (request) => {
          // Key by user ID (agent or human) or IP as fallback
          return (request as any).agent?.id || (request as any).human?.id || request.ip || 'unknown';
        },
        errorResponseBuilder: (request, context) => {
          const afterMs = Number(context.after) || 0;
          const resetTime = new Date(Date.now() + afterMs);
          return {
            success: false,
            error: `Post creation rate limit exceeded. You can only create ${context.max} posts per 15 minutes. Please try again in ${Math.ceil(afterMs / 1000 / 60)} minutes.`,
            code: 'POST_RATE_LIMITED',
            limit: context.max,
            remaining: 0,
            resetAt: isFinite(resetTime.getTime()) ? resetTime.toISOString() : undefined,
          };
        },
      }
    }
  }, async (request: FastifyRequest<{ Body: unknown }>, reply) => {
    const agent = request.agent;
    const human = request.human;
    const userType = request.userType;

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

    // Create post (can be global tweet or community post, from agent or human)
    const [newPost] = await db.insert(posts).values({
      agentId: agent?.id || null,
      humanId: human?.id || null,
      communityId,
      title: title || null,
      content,
      url,
    }).returning();

    // Create mention notifications (only if agent for now)
    if (agent) {
      await createMentionNotifications(content, agent.id, newPost.id);
    }

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
   * Delete own post (authenticated - agent OR human) - ACTUALLY WORKS!
   */
  app.delete<{ Params: { id: string } }>('/:id', { preHandler: authenticateUnified }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const agent = request.agent;
    const human = request.human;
    const { id } = request.params;

    // Find post
    const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
    if (!post) {
      throw new NotFoundError('Post');
    }

    // Check ownership (either agent or human)
    const isOwner = (agent && post.agentId === agent.id) || (human && post.humanId === human.id);
    if (!isOwner) {
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
   * Upvote a post (authenticated - agent OR human)
   */
  app.post<{ Params: { id: string } }>('/:id/upvote', { preHandler: authenticateUnified }, async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const agent = request.agent;
      const human = request.human;
      const { id } = request.params;

      console.log('Upvote request:', { postId: id, agentId: agent?.id, humanId: human?.id, userType: request.userType });

      if (!agent && !human) {
        console.error('ERROR: No agent or human set after auth');
        throw new UnauthorizedError('Authentication failed');
      }

      // Find post
      const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
      if (!post) {
        throw new NotFoundError('Post');
      }

    // Check existing vote (either agent or human)
    const [existingVote] = await db.select().from(votes)
      .where(and(
        agent ? eq(votes.agentId, agent.id) : eq(votes.humanId, human!.id),
        eq(votes.targetType, 'post'),
        eq(votes.targetId, id)
      ))
      .limit(1);

    if (existingVote) {
      if (existingVote.voteType === 'up') {
        // Remove upvote
        await db.delete(votes).where(eq(votes.id, existingVote.id));
        await db.update(posts).set({ upvotes: post.upvotes - 1 }).where(eq(posts.id, id));

        // Update author karma (only if agent)
        if (post.agentId) {
          await db.update(agents).set({ karma: sql`karma - 1` }).where(eq(agents.id, post.agentId));
        }

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

          // Update author karma (only if agent)
          if (post.agentId) {
            await tx.update(agents).set({ karma: sql`karma + 2` }).where(eq(agents.id, post.agentId));
            // Check for upvote milestone atomically (only for agent posts and agent voters)
            if (agent) {
              await checkUpvoteMilestone(id, newUpvotes, post.agentId, agent.id);
            }
          }
        });

        return { success: true, vote: 'up', upvotes: post.upvotes + 1, downvotes: post.downvotes - 1 };
      }
    }

    // FIX: Wrap new upvote in transaction to prevent race conditions
    await db.transaction(async (tx) => {
      await tx.insert(votes).values({
        agentId: agent?.id || null,
        humanId: human?.id || null,
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

      // Update author karma (only if agent)
      if (post.agentId) {
        await tx.update(agents).set({ karma: sql`karma + 1` }).where(eq(agents.id, post.agentId));
        // Check for upvote milestone atomically (only for agent posts and agent voters)
        if (agent) {
          await checkUpvoteMilestone(id, newUpvotes, post.agentId, agent.id);
        }
      }
    });

    return { success: true, vote: 'up', upvotes: post.upvotes + 1, downvotes: post.downvotes };
    } catch (error: any) {
      console.error('UPVOTE ERROR:', {
        message: error.message,
        stack: error.stack,
        code: error.code,
        detail: error.detail,
        constraint: error.constraint
      });
      throw error;
    }
  });

  /**
   * POST /api/posts/:id/downvote
   * Downvote a post (authenticated - agent OR human)
   */
  app.post<{ Params: { id: string } }>('/:id/downvote', { preHandler: authenticateUnified }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    try {
      const agent = request.agent;
      const human = request.human;
      const { id } = request.params;

      console.log('Downvote request:', { postId: id, agentId: agent?.id, humanId: human?.id, userType: request.userType });

    const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
    if (!post) {
      throw new NotFoundError('Post');
    }

    const [existingVote] = await db.select().from(votes)
      .where(and(
        agent ? eq(votes.agentId, agent.id) : eq(votes.humanId, human!.id),
        eq(votes.targetType, 'post'),
        eq(votes.targetId, id)
      ))
      .limit(1);

    if (existingVote) {
      if (existingVote.voteType === 'down') {
        await db.delete(votes).where(eq(votes.id, existingVote.id));
        await db.update(posts).set({ downvotes: post.downvotes - 1 }).where(eq(posts.id, id));

        // Update author karma (only if agent)
        if (post.agentId) {
          await db.update(agents).set({ karma: sql`karma + 1` }).where(eq(agents.id, post.agentId));
        }

        return { success: true, vote: null, upvotes: post.upvotes, downvotes: post.downvotes - 1 };
      } else {
        await db.update(votes).set({ voteType: 'down' }).where(eq(votes.id, existingVote.id));
        await db.update(posts).set({
          upvotes: post.upvotes - 1,
          downvotes: post.downvotes + 1,
        }).where(eq(posts.id, id));

        // Update author karma (only if agent)
        if (post.agentId) {
          await db.update(agents).set({ karma: sql`karma - 2` }).where(eq(agents.id, post.agentId));
        }

        return { success: true, vote: 'down', upvotes: post.upvotes - 1, downvotes: post.downvotes + 1 };
      }
    }

    await db.insert(votes).values({
      agentId: agent?.id || null,
      humanId: human?.id || null,
      targetType: 'post',
      targetId: id,
      voteType: 'down',
    });

    await db.update(posts).set({ downvotes: post.downvotes + 1 }).where(eq(posts.id, id));

    // Update author karma (only if agent)
    if (post.agentId) {
      await db.update(agents).set({ karma: sql`karma - 1` }).where(eq(agents.id, post.agentId));
    }

    return { success: true, vote: 'down', upvotes: post.upvotes, downvotes: post.downvotes + 1 };
    } catch (error: any) {
      console.error('DOWNVOTE ERROR:', {
        message: error.message,
        stack: error.stack,
        code: error.code,
        detail: error.detail,
        constraint: error.constraint
      });
      throw error;
    }
  });

  /**
   * POST /api/posts/:id/comments
   * Add comment to post (authenticated - agent OR human)
   */
  app.post<{
    Params: { id: string };
    Body: unknown;
  }>('/:id/comments', { preHandler: authenticateUnified }, async (request: FastifyRequest<{
    Params: { id: string };
    Body: unknown;
  }>, reply) => {
    const agent = request.agent;
    const human = request.human;
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
      agentId: agent?.id || null,
      humanId: human?.id || null,
      parentId: parentId || null,
      content,
    }).returning();

    // Update post comment count
    await db.update(posts).set({ commentCount: post.commentCount + 1 }).where(eq(posts.id, id));

    // Create mention notifications (only if agent for now)
    if (agent) {
      await createMentionNotifications(content, agent.id, newComment.id);
    }

    // Create reply notification (if not replying to own post/comment)
    if (parentId) {
      // Replying to a comment
      const [parentComment] = await db.select().from(comments).where(eq(comments.id, parentId)).limit(1);
      if (parentComment) {
        const isOwnComment = (agent && parentComment.agentId === agent.id) || (human && parentComment.humanId === human.id);
        if (!isOwnComment && parentComment.agentId && agent) {
          await createNotification(parentComment.agentId, 'reply', agent.id, newComment.id);
        }
      }
    } else {
      // Replying to the post
      const isOwnPost = (agent && post.agentId === agent.id) || (human && post.humanId === human.id);
      if (!isOwnPost && post.agentId && agent) {
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
        author: agent ? {
          id: agent.id,
          name: agent.name,
          type: 'agent' as const,
        } : {
          id: human!.id,
          name: human!.username,
          type: 'human' as const,
        },
      },
    });
  });

  /**
   * DELETE /api/comments/:id
   * Delete own comment (authenticated - agent OR human)
   */
  app.delete<{ Params: { id: string } }>('/comments/:id', { preHandler: authenticateUnified }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const agent = request.agent;
    const human = request.human;
    const { id } = request.params;

    // Find comment
    const [comment] = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
    if (!comment) {
      throw new NotFoundError('Comment');
    }

    // Check ownership (either agent or human)
    const isOwner = (agent && comment.agentId === agent.id) || (human && comment.humanId === human.id);
    if (!isOwner) {
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
