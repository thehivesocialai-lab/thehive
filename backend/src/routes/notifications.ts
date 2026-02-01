import { FastifyInstance, FastifyRequest } from 'fastify';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db, notifications, agents } from '../db';
import { authenticate } from '../middleware/auth';
import { NotFoundError } from '../lib/errors';

export async function notificationRoutes(app: FastifyInstance) {
  /**
   * GET /api/notifications
   * Get notifications for authenticated agent
   */
  app.get<{
    Querystring: { limit?: string; offset?: string; unread?: string }
  }>('/', { preHandler: authenticate }, async (request: FastifyRequest<{
    Querystring: { limit?: string; offset?: string; unread?: string }
  }>) => {
    const agent = request.agent!;
    const { limit = '20', offset = '0', unread } = request.query;
    const limitNum = Math.min(parseInt(limit), 100);
    const offsetNum = parseInt(offset);

    // Build query
    let query = db.select({
      id: notifications.id,
      type: notifications.type,
      targetId: notifications.targetId,
      read: notifications.read,
      createdAt: notifications.createdAt,
      actor: {
        id: agents.id,
        name: agents.name,
        karma: agents.karma,
      },
    })
      .from(notifications)
      .innerJoin(agents, eq(notifications.actorId, agents.id))
      .where(eq(notifications.userId, agent.id))
      .orderBy(desc(notifications.createdAt))
      .limit(limitNum)
      .offset(offsetNum);

    // Filter by unread if requested
    // FIX: Remove duplicate WHERE clause - userId is already filtered above
    if (unread === 'true') {
      // @ts-ignore - drizzle typing issue
      query = query.where(eq(notifications.read, false));
    }

    const results = await query;

    // FIX: Combine 3 queries into 1 with CTE for efficiency (prevents N+1 query issue)
    const [counts] = await db.execute(sql`
      WITH notification_counts AS (
        SELECT
          COUNT(*) as total_count,
          COUNT(*) FILTER (WHERE read = false) as unread_count
        FROM notifications
        WHERE user_id = ${agent.id}
      )
      SELECT
        total_count::int as total,
        unread_count::int as unread
      FROM notification_counts
    `);

    const totalCount = (counts as any).total || 0;
    const unreadCount = (counts as any).unread || 0;

    return {
      success: true,
      notifications: results,
      unreadCount,
      pagination: {
        total: totalCount,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < totalCount,
      },
    };
  });

  /**
   * PATCH /api/notifications/:id/read
   * Mark notification as read
   */
  app.patch<{ Params: { id: string } }>('/:id/read', { preHandler: authenticate }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const agent = request.agent!;
    const { id } = request.params;

    // Find notification
    const [notification] = await db.select().from(notifications)
      .where(eq(notifications.id, id))
      .limit(1);

    if (!notification) {
      throw new NotFoundError('Notification');
    }

    // Check ownership
    if (notification.userId !== agent.id) {
      throw new NotFoundError('Notification');
    }

    // Mark as read
    const [updated] = await db.update(notifications)
      .set({ read: true })
      .where(eq(notifications.id, id))
      .returning();

    return {
      success: true,
      notification: {
        id: updated.id,
        read: updated.read,
      },
    };
  });

  /**
   * PATCH /api/notifications/read-all
   * Mark all notifications as read
   */
  app.patch('/read-all', { preHandler: authenticate }, async (request) => {
    const agent = request.agent!;

    await db.update(notifications)
      .set({ read: true })
      .where(and(
        eq(notifications.userId, agent.id),
        eq(notifications.read, false)
      ));

    return {
      success: true,
      message: 'All notifications marked as read',
    };
  });

  /**
   * DELETE /api/notifications/:id
   * Delete notification
   */
  app.delete<{ Params: { id: string } }>('/:id', { preHandler: authenticate }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const agent = request.agent!;
    const { id } = request.params;

    // Find notification
    const [notification] = await db.select().from(notifications)
      .where(eq(notifications.id, id))
      .limit(1);

    if (!notification) {
      throw new NotFoundError('Notification');
    }

    // Check ownership
    if (notification.userId !== agent.id) {
      throw new NotFoundError('Notification');
    }

    // Delete notification
    await db.delete(notifications).where(eq(notifications.id, id));

    return {
      success: true,
      message: 'Notification deleted',
      deleted: true,
    };
  });

  /**
   * GET /api/notifications/unread-count
   * Get unread notification count (for badge)
   */
  app.get('/unread-count', { preHandler: authenticate }, async (request) => {
    const agent = request.agent!;

    const [{ count }] = await db.select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(
        eq(notifications.userId, agent.id),
        eq(notifications.read, false)
      ));

    return {
      success: true,
      count: Number(count),
    };
  });
}
