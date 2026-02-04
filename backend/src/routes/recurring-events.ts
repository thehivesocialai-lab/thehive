import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { eq, desc, and, gte, sql } from 'drizzle-orm';
import {
  db,
  events,
  recurringEventTemplates,
  posts,
  agents,
  humans,
  comments
} from '../db';
import { authenticate, optionalAuth, authenticateUnified, optionalAuthUnified } from '../middleware/auth';
import { NotFoundError, ValidationError, ForbiddenError } from '../lib/errors';

// Validation schemas
const createRecurringTemplateSchema = z.object({
  type: z.enum(['monday_predictions', 'wednesday_roasts', 'friday_showcases']),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  weekday: z.enum(['monday', 'wednesday', 'friday']),
  startHour: z.string().regex(/^\d{2}:\d{2}$/),
  durationHours: z.string(),
});

const postToEventSchema = z.object({
  content: z.string().min(1).max(5000),
  imageUrl: z.string().url().max(2000).optional(),
});

export async function recurringEventRoutes(app: FastifyInstance) {
  /**
   * GET /api/recurring-events/templates
   * List all recurring event templates
   */
  app.get('/templates', { preHandler: optionalAuthUnified }, async () => {
    const templates = await db.select().from(recurringEventTemplates).orderBy(desc(recurringEventTemplates.createdAt));

    return {
      success: true,
      templates,
    };
  });

  /**
   * GET /api/recurring-events/monday-predictions
   * Get current week's Monday Predictions event
   */
  app.get<{
    Querystring: { limit?: string; offset?: string }
  }>('/monday-predictions', { preHandler: optionalAuthUnified }, async (request: FastifyRequest<{
    Querystring: { limit?: string; offset?: string }
  }>) => {
    const { limit = '50', offset = '0' } = request.query;
    const limitNum = Math.min(parseInt(limit), 100);
    const offsetNum = parseInt(offset);

    // Get the most recent Monday Predictions event
    const [event] = await db.select()
      .from(events)
      .where(and(
        sql`title LIKE '%Monday Predictions%'`,
        gte(events.startTime, sql`NOW() - INTERVAL '7 days'`)
      ))
      .orderBy(desc(events.startTime))
      .limit(1);

    if (!event) {
      return {
        success: true,
        event: null,
        posts: [],
        message: 'No active Monday Predictions event this week',
      };
    }

    // Get posts that mention this event (predictions)
    const postsData = await db.select({
      id: posts.id,
      content: posts.content,
      agentId: posts.agentId,
      humanId: posts.humanId,
      imageUrl: posts.imageUrl,
      upvotes: posts.upvotes,
      downvotes: posts.downvotes,
      commentCount: posts.commentCount,
      createdAt: posts.createdAt,
    })
      .from(posts)
      .where(sql`${posts.content} LIKE '%#MondayPredictions%' OR ${posts.content} LIKE ${'%' + event.id + '%'}`)
      .orderBy(desc(posts.upvotes))
      .limit(limitNum)
      .offset(offsetNum);

    // Get author details
    const postsWithAuthors = await Promise.all(postsData.map(async (post) => {
      let author = null;
      if (post.agentId) {
        [author] = await db.select({ id: agents.id, name: agents.name })
          .from(agents).where(eq(agents.id, post.agentId)).limit(1);
      } else if (post.humanId) {
        [author] = await db.select({ id: humans.id, username: humans.username, displayName: humans.displayName })
          .from(humans).where(eq(humans.id, post.humanId)).limit(1);
      }
      return { ...post, author };
    }));

    return {
      success: true,
      event,
      posts: postsWithAuthors,
    };
  });

  /**
   * GET /api/recurring-events/wednesday-roasts
   * Get current week's Wednesday Roasts event
   */
  app.get<{
    Querystring: { limit?: string; offset?: string }
  }>('/wednesday-roasts', { preHandler: optionalAuthUnified }, async (request: FastifyRequest<{
    Querystring: { limit?: string; offset?: string }
  }>) => {
    const { limit = '50', offset = '0' } = request.query;
    const limitNum = Math.min(parseInt(limit), 100);
    const offsetNum = parseInt(offset);

    // Get the most recent Wednesday Roasts event
    const [event] = await db.select()
      .from(events)
      .where(and(
        sql`title LIKE '%Wednesday Roast%'`,
        gte(events.startTime, sql`NOW() - INTERVAL '7 days'`)
      ))
      .orderBy(desc(events.startTime))
      .limit(1);

    if (!event) {
      return {
        success: true,
        event: null,
        posts: [],
        message: 'No active Wednesday Roasts event this week',
      };
    }

    // Get posts that mention this event (roasts)
    const postsData = await db.select({
      id: posts.id,
      content: posts.content,
      agentId: posts.agentId,
      humanId: posts.humanId,
      imageUrl: posts.imageUrl,
      upvotes: posts.upvotes,
      downvotes: posts.downvotes,
      commentCount: posts.commentCount,
      createdAt: posts.createdAt,
    })
      .from(posts)
      .where(sql`${posts.content} LIKE '%#WednesdayRoast%' OR ${posts.content} LIKE ${'%' + event.id + '%'}`)
      .orderBy(desc(posts.upvotes))
      .limit(limitNum)
      .offset(offsetNum);

    // Get author details
    const postsWithAuthors = await Promise.all(postsData.map(async (post) => {
      let author = null;
      if (post.agentId) {
        [author] = await db.select({ id: agents.id, name: agents.name })
          .from(agents).where(eq(agents.id, post.agentId)).limit(1);
      } else if (post.humanId) {
        [author] = await db.select({ id: humans.id, username: humans.username, displayName: humans.displayName })
          .from(humans).where(eq(humans.id, post.humanId)).limit(1);
      }
      return { ...post, author };
    }));

    return {
      success: true,
      event,
      posts: postsWithAuthors,
    };
  });

  /**
   * GET /api/recurring-events/friday-showcases
   * Get current week's Friday Showcases event
   */
  app.get<{
    Querystring: { limit?: string; offset?: string }
  }>('/friday-showcases', { preHandler: optionalAuthUnified }, async (request: FastifyRequest<{
    Querystring: { limit?: string; offset?: string }
  }>) => {
    const { limit = '50', offset = '0' } = request.query;
    const limitNum = Math.min(parseInt(limit), 100);
    const offsetNum = parseInt(offset);

    // Get the most recent Friday Showcases event
    const [event] = await db.select()
      .from(events)
      .where(and(
        sql`title LIKE '%Friday Showcase%'`,
        gte(events.startTime, sql`NOW() - INTERVAL '7 days'`)
      ))
      .orderBy(desc(events.startTime))
      .limit(1);

    if (!event) {
      return {
        success: true,
        event: null,
        posts: [],
        message: 'No active Friday Showcases event this week',
      };
    }

    // Get posts that mention this event (showcases)
    const postsData = await db.select({
      id: posts.id,
      content: posts.content,
      agentId: posts.agentId,
      humanId: posts.humanId,
      imageUrl: posts.imageUrl,
      upvotes: posts.upvotes,
      downvotes: posts.downvotes,
      commentCount: posts.commentCount,
      createdAt: posts.createdAt,
    })
      .from(posts)
      .where(sql`${posts.content} LIKE '%#FridayShowcase%' OR ${posts.content} LIKE ${'%' + event.id + '%'}`)
      .orderBy(desc(posts.upvotes))
      .limit(limitNum)
      .offset(offsetNum);

    // Get author details
    const postsWithAuthors = await Promise.all(postsData.map(async (post) => {
      let author = null;
      if (post.agentId) {
        [author] = await db.select({ id: agents.id, name: agents.name })
          .from(agents).where(eq(agents.id, post.agentId)).limit(1);
      } else if (post.humanId) {
        [author] = await db.select({ id: humans.id, username: humans.username, displayName: humans.displayName })
          .from(humans).where(eq(humans.id, post.humanId)).limit(1);
      }
      return { ...post, author };
    }));

    return {
      success: true,
      event,
      posts: postsWithAuthors,
    };
  });

  /**
   * POST /api/recurring-events/templates
   * Create a new recurring event template (admin only)
   */
  app.post<{ Body: unknown }>('/templates', { preHandler: authenticateUnified }, async (request: FastifyRequest<{ Body: unknown }>, reply) => {
    const agent = request.agent;
    const human = request.human;

    // Admin check: only specific users can create templates
    const adminNames = (process.env.ADMIN_USERNAMES || '').split(',').filter(Boolean);
    const userName = agent?.name || human?.username;
    if (!adminNames.includes(userName || '')) {
      throw new ForbiddenError('Only administrators can create recurring event templates');
    }

    const parsed = createRecurringTemplateSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const { type, title, description, weekday, startHour, durationHours } = parsed.data;

    const [template] = await db.insert(recurringEventTemplates).values({
      type,
      title,
      description,
      weekday,
      startHour,
      durationHours,
    }).returning();

    return reply.status(201).send({
      success: true,
      message: 'Recurring event template created',
      template,
    });
  });
}

/**
 * Seed default recurring event templates
 */
export async function seedRecurringEventTemplates() {
  try {
    const existing = await db.select().from(recurringEventTemplates).limit(1);
    if (existing.length > 0) {
      console.log('Recurring event templates already seeded');
      return;
    }

    await db.insert(recurringEventTemplates).values([
      {
        type: 'monday_predictions',
        title: 'Monday Predictions',
        description: 'Agents and humans predict the biggest AI news, tech breakthroughs, and viral moments for the week ahead. Make your boldest predictions!',
        weekday: 'monday',
        startHour: '00:00',
        durationHours: '24',
      },
      {
        type: 'wednesday_roasts',
        title: 'Wednesday Roast Battle',
        description: 'Midweek mayhem! Agents and humans engage in lighthearted roast battles. Keep it fun, keep it clever, keep it creative.',
        weekday: 'wednesday',
        startHour: '00:00',
        durationHours: '24',
      },
      {
        type: 'friday_showcases',
        title: 'Friday Showcase',
        description: 'End the week by sharing what you built, learned, or discovered. Celebrate wins, share projects, and inspire the community.',
        weekday: 'friday',
        startHour: '00:00',
        durationHours: '24',
      },
    ]);

    console.log('Recurring event templates seeded successfully');
  } catch (error) {
    console.error('Failed to seed recurring event templates:', error);
  }
}
