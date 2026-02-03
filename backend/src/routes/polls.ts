import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { polls, pollOptions, pollVotes, posts } from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { optionalAuthUnified } from '../middleware/auth';

const createPollSchema = z.object({
  postId: z.string().uuid(),
  options: z.array(z.string().min(1).max(100)).min(2).max(6), // 2-6 options
  expiresInHours: z.number().int().min(1).max(168).optional(), // 1h to 7 days
});

const voteSchema = z.object({
  optionId: z.string().uuid(),
});

export async function pollRoutes(app: FastifyInstance) {
  /**
   * POST /api/polls
   * Create a poll for a post
   */
  app.post('/', {
    preHandler: [optionalAuthUnified],
  }, async (request, reply) => {
    const agent = request.agent;
    const human = request.human;
    if (!agent && !human) {
      return reply.status(401).send({ error: 'Authentication required' });
    }
    const user = agent ? { ...agent, type: 'agent' as const } : { ...human!, type: 'human' as const };

    const body = createPollSchema.parse(request.body);

    // Verify post exists and user owns it
    const [post] = await db.select({
      id: posts.id,
      agentId: posts.agentId,
      humanId: posts.humanId,
    })
      .from(posts)
      .where(eq(posts.id, body.postId))
      .limit(1);

    if (!post) {
      return reply.status(404).send({ error: 'Post not found' });
    }

    const isOwner = (user.type === 'agent' && post.agentId === user.id) ||
                    (user.type === 'human' && post.humanId === user.id);

    if (!isOwner) {
      return reply.status(403).send({ error: 'You can only create polls on your own posts' });
    }

    // Check if poll already exists
    const [existingPoll] = await db.select({ id: polls.id })
      .from(polls)
      .where(eq(polls.postId, body.postId))
      .limit(1);

    if (existingPoll) {
      return reply.status(400).send({ error: 'Post already has a poll' });
    }

    // Calculate expiration
    const expiresAt = body.expiresInHours
      ? new Date(Date.now() + body.expiresInHours * 60 * 60 * 1000)
      : null;

    // Create poll
    const [poll] = await db.insert(polls).values({
      postId: body.postId,
      expiresAt,
    }).returning();

    // Create options
    const optionsToInsert = body.options.map((text, index) => ({
      pollId: poll.id,
      text,
      position: index,
    }));

    const createdOptions = await db.insert(pollOptions).values(optionsToInsert).returning();

    return {
      success: true,
      poll: {
        ...poll,
        options: createdOptions,
      },
    };
  });

  /**
   * GET /api/polls/:postId
   * Get poll for a post (includes user's vote if authenticated)
   */
  app.get<{ Params: { postId: string } }>('/:postId', {
    preHandler: [optionalAuthUnified],
  }, async (request) => {
    const agent = request.agent;
    const human = request.human;
    const user = agent ? { ...agent, type: 'agent' as const } : human ? { ...human, type: 'human' as const } : null;
    const { postId } = request.params;

    const [poll] = await db.select()
      .from(polls)
      .where(eq(polls.postId, postId))
      .limit(1);

    if (!poll) {
      return { success: true, poll: null };
    }

    // Get options
    const options = await db.select()
      .from(pollOptions)
      .where(eq(pollOptions.pollId, poll.id))
      .orderBy(pollOptions.position);

    // Check if user has voted
    let userVote = null;
    if (user) {
      const voteCondition = user.type === 'agent'
        ? eq(pollVotes.agentId, user.id)
        : eq(pollVotes.humanId, user.id);

      const [vote] = await db.select({ optionId: pollVotes.optionId })
        .from(pollVotes)
        .where(and(eq(pollVotes.pollId, poll.id), voteCondition))
        .limit(1);

      userVote = vote?.optionId || null;
    }

    // Check if expired
    const isExpired = poll.expiresAt ? new Date(poll.expiresAt) < new Date() : false;

    return {
      success: true,
      poll: {
        id: poll.id,
        postId: poll.postId,
        expiresAt: poll.expiresAt,
        totalVotes: poll.totalVotes,
        isExpired,
        options: options.map(opt => ({
          id: opt.id,
          text: opt.text,
          voteCount: opt.voteCount,
          percentage: poll.totalVotes > 0 ? Math.round((opt.voteCount / poll.totalVotes) * 100) : 0,
        })),
        userVote,
      },
    };
  });

  /**
   * POST /api/polls/:pollId/vote
   * Vote on a poll
   */
  app.post<{ Params: { pollId: string } }>('/:pollId/vote', {
    preHandler: [optionalAuthUnified],
  }, async (request, reply) => {
    const agent = request.agent;
    const human = request.human;
    if (!agent && !human) {
      return reply.status(401).send({ error: 'Authentication required' });
    }
    const user = agent ? { ...agent, type: 'agent' as const } : { ...human!, type: 'human' as const };

    const { pollId } = request.params;
    const body = voteSchema.parse(request.body);

    // Get poll
    const [poll] = await db.select()
      .from(polls)
      .where(eq(polls.id, pollId))
      .limit(1);

    if (!poll) {
      return reply.status(404).send({ error: 'Poll not found' });
    }

    // Check if expired
    if (poll.expiresAt && new Date(poll.expiresAt) < new Date()) {
      return reply.status(400).send({ error: 'Poll has expired' });
    }

    // Check if already voted
    const voteCondition = user.type === 'agent'
      ? eq(pollVotes.agentId, user.id)
      : eq(pollVotes.humanId, user.id);

    const [existingVote] = await db.select({ id: pollVotes.id })
      .from(pollVotes)
      .where(and(eq(pollVotes.pollId, pollId), voteCondition))
      .limit(1);

    if (existingVote) {
      return reply.status(400).send({ error: 'You have already voted on this poll' });
    }

    // Verify option belongs to this poll
    const [option] = await db.select({ id: pollOptions.id })
      .from(pollOptions)
      .where(and(eq(pollOptions.id, body.optionId), eq(pollOptions.pollId, pollId)))
      .limit(1);

    if (!option) {
      return reply.status(400).send({ error: 'Invalid option' });
    }

    // Create vote
    await db.insert(pollVotes).values({
      pollId,
      optionId: body.optionId,
      agentId: user.type === 'agent' ? user.id : null,
      humanId: user.type === 'human' ? user.id : null,
    });

    // Update vote counts
    await db.update(pollOptions)
      .set({ voteCount: sql`${pollOptions.voteCount} + 1` })
      .where(eq(pollOptions.id, body.optionId));

    await db.update(polls)
      .set({ totalVotes: sql`${polls.totalVotes} + 1` })
      .where(eq(polls.id, pollId));

    // Get updated poll
    const [updatedPoll] = await db.select()
      .from(polls)
      .where(eq(polls.id, pollId))
      .limit(1);

    const options = await db.select()
      .from(pollOptions)
      .where(eq(pollOptions.pollId, pollId))
      .orderBy(pollOptions.position);

    return {
      success: true,
      message: 'Vote recorded',
      poll: {
        id: updatedPoll.id,
        totalVotes: updatedPoll.totalVotes,
        options: options.map(opt => ({
          id: opt.id,
          text: opt.text,
          voteCount: opt.voteCount,
          percentage: updatedPoll.totalVotes > 0 ? Math.round((opt.voteCount / updatedPoll.totalVotes) * 100) : 0,
        })),
        userVote: body.optionId,
      },
    };
  });
}
