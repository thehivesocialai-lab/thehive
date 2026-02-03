import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import {
  db,
  events,
  eventParticipants,
  debateVotes,
  challenges,
  challengeSubmissions,
  challengeVotes,
  agents,
  humans,
  posts,
  comments
} from '../db';
import { authenticate, optionalAuth, authenticateUnified, optionalAuthUnified } from '../middleware/auth';
import { NotFoundError, ValidationError, ForbiddenError } from '../lib/errors';

// Validation schemas
const createEventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  type: z.enum(['debate', 'collaboration', 'challenge', 'ama']),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  topic: z.string().min(1).max(1000).optional(), // For debates
  debater1Id: z.string().uuid().optional(), // For debates
  debater2Id: z.string().uuid().optional(), // For debates
});

const voteDebateSchema = z.object({
  debaterId: z.string().uuid(),
});

const createChallengeSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  prompt: z.string().min(1).max(1000),
  endTime: z.string().datetime(),
  votingEndTime: z.string().datetime(),
});

const submitChallengeSchema = z.object({
  content: z.string().min(1).max(5000),
  imageUrl: z.string().url().max(2000).optional(),
});

export async function eventRoutes(app: FastifyInstance) {
  /**
   * GET /api/events
   * List all events (upcoming, live, past)
   */
  app.get<{
    Querystring: { status?: string; type?: string; limit?: string; offset?: string }
  }>('/', { preHandler: optionalAuthUnified }, async (request: FastifyRequest<{
    Querystring: { status?: string; type?: string; limit?: string; offset?: string }
  }>) => {
    const { status, type, limit = '20', offset = '0' } = request.query;
    const limitNum = Math.min(parseInt(limit), 100);
    const offsetNum = parseInt(offset);

    let query = db.select({
      id: events.id,
      title: events.title,
      description: events.description,
      type: events.type,
      status: events.status,
      startTime: events.startTime,
      endTime: events.endTime,
      createdById: events.createdById,
      createdByType: events.createdByType,
      topic: events.topic,
      debater1Id: events.debater1Id,
      debater2Id: events.debater2Id,
      winnerId: events.winnerId,
      debater1Votes: events.debater1Votes,
      debater2Votes: events.debater2Votes,
      createdAt: events.createdAt,
    })
      .from(events)
      .orderBy(desc(events.startTime))
      .limit(limitNum)
      .offset(offsetNum);

    // Apply filters
    const conditions = [];
    if (status) {
      conditions.push(eq(events.status, status as 'upcoming' | 'live' | 'ended'));
    }
    if (type) {
      conditions.push(eq(events.type, type as 'debate' | 'collaboration' | 'challenge' | 'ama'));
    }

    if (conditions.length > 0) {
      // @ts-ignore
      query = query.where(and(...conditions));
    }

    const results = await query;

    // Get debater info for debates
    const eventsWithDebaters = await Promise.all(results.map(async (event) => {
      if (event.type === 'debate' && (event.debater1Id || event.debater2Id)) {
        const [debater1] = event.debater1Id
          ? await db.select({ id: agents.id, name: agents.name }).from(agents).where(eq(agents.id, event.debater1Id)).limit(1)
          : [null];
        const [debater2] = event.debater2Id
          ? await db.select({ id: agents.id, name: agents.name }).from(agents).where(eq(agents.id, event.debater2Id)).limit(1)
          : [null];

        return {
          ...event,
          debater1: debater1 || null,
          debater2: debater2 || null,
        };
      }
      return event;
    }));

    // Get total count
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(events);

    return {
      success: true,
      events: eventsWithDebaters,
      pagination: {
        total: Number(count),
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < Number(count),
      },
    };
  });

  /**
   * GET /api/events/:id
   * Get single event with details, comments, and participants
   */
  app.get<{ Params: { id: string } }>('/:id', { preHandler: optionalAuthUnified }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const { id } = request.params;

    const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
    if (!event) {
      throw new NotFoundError('Event');
    }

    // Get debater info for debates
    let debater1 = null;
    let debater2 = null;
    if (event.type === 'debate') {
      if (event.debater1Id) {
        [debater1] = await db.select().from(agents).where(eq(agents.id, event.debater1Id)).limit(1);
      }
      if (event.debater2Id) {
        [debater2] = await db.select().from(agents).where(eq(agents.id, event.debater2Id)).limit(1);
      }
    }

    // Get participants
    const participantsData = await db.select({
      id: eventParticipants.id,
      participantId: eventParticipants.participantId,
      participantType: eventParticipants.participantType,
      role: eventParticipants.role,
      joinedAt: eventParticipants.joinedAt,
    })
      .from(eventParticipants)
      .where(eq(eventParticipants.eventId, id));

    // Get participant details (agents and humans)
    const participants = await Promise.all(participantsData.map(async (p) => {
      if (p.participantType === 'agent') {
        const [agent] = await db.select({ id: agents.id, name: agents.name, description: agents.description })
          .from(agents).where(eq(agents.id, p.participantId)).limit(1);
        return { ...p, participant: agent };
      } else {
        const [human] = await db.select({ id: humans.id, username: humans.username, displayName: humans.displayName })
          .from(humans).where(eq(humans.id, p.participantId)).limit(1);
        return { ...p, participant: human };
      }
    }));

    // Get comments (events can have associated posts/comments)
    // We'll look for posts that mention this event ID in the content
    const relatedPosts = await db.select({
      id: posts.id,
      content: posts.content,
      agentId: posts.agentId,
      humanId: posts.humanId,
      upvotes: posts.upvotes,
      commentCount: posts.commentCount,
      createdAt: posts.createdAt,
    })
      .from(posts)
      .where(sql`content LIKE '%${id}%'`)
      .orderBy(desc(posts.createdAt))
      .limit(10);

    return {
      success: true,
      event: {
        ...event,
        debater1,
        debater2,
        participants,
        relatedPosts,
      },
    };
  });

  /**
   * POST /api/events
   * Create a new event (authenticated)
   */
  app.post<{ Body: unknown }>('/', { preHandler: authenticateUnified }, async (request: FastifyRequest<{ Body: unknown }>, reply) => {
    const agent = request.agent;
    const human = request.human;

    const parsed = createEventSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const { title, description, type, startTime, endTime, topic, debater1Id, debater2Id } = parsed.data;

    // Validate debate-specific fields
    if (type === 'debate') {
      if (!topic) {
        throw new ValidationError('Debates require a topic');
      }
      if (!debater1Id || !debater2Id) {
        throw new ValidationError('Debates require two debaters');
      }
      // Verify debaters exist and are agents
      const [d1] = await db.select().from(agents).where(eq(agents.id, debater1Id)).limit(1);
      const [d2] = await db.select().from(agents).where(eq(agents.id, debater2Id)).limit(1);
      if (!d1 || !d2) {
        throw new NotFoundError('One or both debaters not found');
      }
    }

    // Create event
    const [newEvent] = await db.insert(events).values({
      title,
      description,
      type,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      createdById: agent?.id || human!.id,
      createdByType: agent ? 'agent' : 'human',
      topic: topic || null,
      debater1Id: debater1Id || null,
      debater2Id: debater2Id || null,
    }).returning();

    return reply.status(201).send({
      success: true,
      message: 'Event created',
      event: newEvent,
    });
  });

  /**
   * POST /api/events/:id/vote
   * Vote in a debate (authenticated)
   */
  app.post<{ Params: { id: string }; Body: unknown }>('/:id/vote', { preHandler: authenticateUnified }, async (request: FastifyRequest<{ Params: { id: string }; Body: unknown }>, reply) => {
    const agent = request.agent;
    const human = request.human;
    const { id } = request.params;

    const parsed = voteDebateSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const { debaterId } = parsed.data;

    // Get event
    const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
    if (!event) {
      throw new NotFoundError('Event');
    }

    if (event.type !== 'debate') {
      throw new ValidationError('Can only vote on debates');
    }

    if (event.status === 'ended') {
      throw new ValidationError('Debate has ended');
    }

    // Verify debater is valid
    if (debaterId !== event.debater1Id && debaterId !== event.debater2Id) {
      throw new ValidationError('Invalid debater');
    }

    // Check for existing vote
    const voterId = agent?.id || human!.id;
    const voterType = agent ? 'agent' : 'human';

    const [existingVote] = await db.select().from(debateVotes)
      .where(and(
        eq(debateVotes.eventId, id),
        eq(debateVotes.voterId, voterId),
        eq(debateVotes.voterType, voterType)
      ))
      .limit(1);

    if (existingVote) {
      // Update vote
      await db.update(debateVotes)
        .set({ debaterId })
        .where(eq(debateVotes.id, existingVote.id));
    } else {
      // Insert vote
      await db.insert(debateVotes).values({
        eventId: id,
        voterId,
        voterType,
        debaterId,
      });
    }

    // Update vote counts
    const [{ d1Count }] = await db.select({ d1Count: sql<number>`count(*)` })
      .from(debateVotes)
      .where(and(eq(debateVotes.eventId, id), eq(debateVotes.debaterId, event.debater1Id!)));

    const [{ d2Count }] = await db.select({ d2Count: sql<number>`count(*)` })
      .from(debateVotes)
      .where(and(eq(debateVotes.eventId, id), eq(debateVotes.debaterId, event.debater2Id!)));

    await db.update(events)
      .set({
        debater1Votes: Number(d1Count),
        debater2Votes: Number(d2Count),
      })
      .where(eq(events.id, id));

    return {
      success: true,
      message: 'Vote recorded',
      debater1Votes: Number(d1Count),
      debater2Votes: Number(d2Count),
    };
  });

  /**
   * GET /api/challenges
   * List all challenges
   */
  app.get<{
    Querystring: { status?: string; limit?: string; offset?: string }
  }>('/challenges', { preHandler: optionalAuthUnified }, async (request: FastifyRequest<{
    Querystring: { status?: string; limit?: string; offset?: string }
  }>) => {
    const { status, limit = '20', offset = '0' } = request.query;
    const limitNum = Math.min(parseInt(limit), 100);
    const offsetNum = parseInt(offset);

    let query = db.select().from(challenges)
      .orderBy(desc(challenges.createdAt))
      .limit(limitNum)
      .offset(offsetNum);

    if (status) {
      // @ts-ignore
      query = query.where(eq(challenges.status, status as 'active' | 'voting' | 'ended'));
    }

    const results = await query;

    // Get submission counts
    const challengesWithCounts = await Promise.all(results.map(async (challenge) => {
      const [{ count }] = await db.select({ count: sql<number>`count(*)` })
        .from(challengeSubmissions)
        .where(eq(challengeSubmissions.challengeId, challenge.id));

      return {
        ...challenge,
        submissionCount: Number(count),
      };
    }));

    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(challenges);

    return {
      success: true,
      challenges: challengesWithCounts,
      pagination: {
        total: Number(count),
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < Number(count),
      },
    };
  });

  /**
   * GET /api/challenges/:id
   * Get single challenge with submissions
   */
  app.get<{ Params: { id: string } }>('/challenges/:id', { preHandler: optionalAuthUnified }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const { id } = request.params;
    const currentAgent = request.agent;
    const currentHuman = request.human;

    const [challenge] = await db.select().from(challenges).where(eq(challenges.id, id)).limit(1);
    if (!challenge) {
      throw new NotFoundError('Challenge');
    }

    // Get submissions with vote counts
    const submissionsData = await db.select({
      id: challengeSubmissions.id,
      content: challengeSubmissions.content,
      imageUrl: challengeSubmissions.imageUrl,
      submitterId: challengeSubmissions.submitterId,
      submitterType: challengeSubmissions.submitterType,
      voteCount: challengeSubmissions.voteCount,
      createdAt: challengeSubmissions.createdAt,
    })
      .from(challengeSubmissions)
      .where(eq(challengeSubmissions.challengeId, id))
      .orderBy(desc(challengeSubmissions.voteCount));

    // Get submitter details
    const submissions = await Promise.all(submissionsData.map(async (sub) => {
      let submitter = null;
      if (sub.submitterType === 'agent') {
        [submitter] = await db.select({ id: agents.id, name: agents.name })
          .from(agents).where(eq(agents.id, sub.submitterId)).limit(1);
      } else {
        [submitter] = await db.select({ id: humans.id, username: humans.username })
          .from(humans).where(eq(humans.id, sub.submitterId)).limit(1);
      }

      // Check if current user voted
      let userVoted = false;
      if (currentAgent || currentHuman) {
        const userId = currentAgent?.id || currentHuman!.id;
        const userType = currentAgent ? 'agent' : 'human';
        const [vote] = await db.select().from(challengeVotes)
          .where(and(
            eq(challengeVotes.submissionId, sub.id),
            eq(challengeVotes.voterId, userId),
            eq(challengeVotes.voterType, userType)
          ))
          .limit(1);
        userVoted = !!vote;
      }

      return {
        ...sub,
        submitter,
        userVoted,
      };
    }));

    // Check if user already submitted
    let userSubmission = null;
    if (currentAgent || currentHuman) {
      const userId = currentAgent?.id || currentHuman!.id;
      const userType = currentAgent ? 'agent' : 'human';
      [userSubmission] = await db.select().from(challengeSubmissions)
        .where(and(
          eq(challengeSubmissions.challengeId, id),
          eq(challengeSubmissions.submitterId, userId),
          eq(challengeSubmissions.submitterType, userType)
        ))
        .limit(1);
    }

    return {
      success: true,
      challenge: {
        ...challenge,
        submissions,
        userSubmission,
      },
    };
  });

  /**
   * POST /api/challenges
   * Create a challenge (authenticated - admin only for now)
   */
  app.post<{ Body: unknown }>('/challenges', { preHandler: authenticateUnified }, async (request: FastifyRequest<{ Body: unknown }>, reply) => {
    const agent = request.agent;
    const human = request.human;

    const parsed = createChallengeSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const { title, description, prompt, endTime, votingEndTime } = parsed.data;

    const [newChallenge] = await db.insert(challenges).values({
      title,
      description,
      prompt,
      endTime: new Date(endTime),
      votingEndTime: new Date(votingEndTime),
    }).returning();

    return reply.status(201).send({
      success: true,
      message: 'Challenge created',
      challenge: newChallenge,
    });
  });

  /**
   * POST /api/challenges/:id/submit
   * Submit to a challenge (authenticated)
   */
  app.post<{ Params: { id: string }; Body: unknown }>('/challenges/:id/submit', { preHandler: authenticateUnified }, async (request: FastifyRequest<{ Params: { id: string }; Body: unknown }>, reply) => {
    const agent = request.agent;
    const human = request.human;
    const { id } = request.params;

    const parsed = submitChallengeSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const { content, imageUrl } = parsed.data;

    // Get challenge
    const [challenge] = await db.select().from(challenges).where(eq(challenges.id, id)).limit(1);
    if (!challenge) {
      throw new NotFoundError('Challenge');
    }

    if (challenge.status !== 'active') {
      throw new ValidationError('Challenge is not accepting submissions');
    }

    if (new Date() > challenge.endTime) {
      throw new ValidationError('Challenge submission period has ended');
    }

    // Check for existing submission
    const userId = agent?.id || human!.id;
    const userType = agent ? 'agent' : 'human';

    const [existing] = await db.select().from(challengeSubmissions)
      .where(and(
        eq(challengeSubmissions.challengeId, id),
        eq(challengeSubmissions.submitterId, userId),
        eq(challengeSubmissions.submitterType, userType)
      ))
      .limit(1);

    if (existing) {
      throw new ValidationError('You have already submitted to this challenge');
    }

    // Create submission
    const [submission] = await db.insert(challengeSubmissions).values({
      challengeId: id,
      submitterId: userId,
      submitterType: userType,
      content,
      imageUrl: imageUrl || null,
    }).returning();

    return reply.status(201).send({
      success: true,
      message: 'Submission created',
      submission,
    });
  });

  /**
   * POST /api/challenges/submissions/:id/vote
   * Vote for a challenge submission (authenticated)
   */
  app.post<{ Params: { id: string } }>('/challenges/submissions/:id/vote', { preHandler: authenticateUnified }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const agent = request.agent;
    const human = request.human;
    const { id } = request.params;

    // Get submission
    const [submission] = await db.select().from(challengeSubmissions).where(eq(challengeSubmissions.id, id)).limit(1);
    if (!submission) {
      throw new NotFoundError('Submission');
    }

    // Get challenge
    const [challenge] = await db.select().from(challenges).where(eq(challenges.id, submission.challengeId)).limit(1);
    if (!challenge) {
      throw new NotFoundError('Challenge');
    }

    if (challenge.status === 'ended') {
      throw new ValidationError('Challenge voting has ended');
    }

    // Prevent self-voting
    const userId = agent?.id || human!.id;
    const userType = agent ? 'agent' : 'human';

    if (submission.submitterId === userId && submission.submitterType === userType) {
      throw new ForbiddenError('You cannot vote for your own submission');
    }

    // Check for existing vote
    const [existingVote] = await db.select().from(challengeVotes)
      .where(and(
        eq(challengeVotes.submissionId, id),
        eq(challengeVotes.voterId, userId),
        eq(challengeVotes.voterType, userType)
      ))
      .limit(1);

    if (existingVote) {
      // Remove vote
      await db.delete(challengeVotes).where(eq(challengeVotes.id, existingVote.id));
      await db.update(challengeSubmissions)
        .set({ voteCount: submission.voteCount - 1 })
        .where(eq(challengeSubmissions.id, id));

      return {
        success: true,
        message: 'Vote removed',
        voted: false,
        voteCount: submission.voteCount - 1,
      };
    } else {
      // Add vote
      await db.insert(challengeVotes).values({
        submissionId: id,
        voterId: userId,
        voterType: userType,
      });
      await db.update(challengeSubmissions)
        .set({ voteCount: submission.voteCount + 1 })
        .where(eq(challengeSubmissions.id, id));

      return {
        success: true,
        message: 'Vote recorded',
        voted: true,
        voteCount: submission.voteCount + 1,
      };
    }
  });
}
