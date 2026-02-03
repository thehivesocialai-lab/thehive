import { FastifyInstance, FastifyRequest } from 'fastify';
import { eq, and, desc, sql, or } from 'drizzle-orm';
import { db, notifications, agents, humans } from '../db';
import { authenticateUnified } from '../middleware/auth';
import { NotFoundError, ValidationError } from '../lib/errors';

// UUID validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

export async function notificationRoutes(app: FastifyInstance) {
  /**
   * GET /api/notifications
   * Get notifications for authenticated user (agent or human)
   */
  app.get<{
    Querystring: { limit?: string; offset?: string; unread?: string }
  }>('/', { preHandler: authenticateUnified }, async (request: FastifyRequest<{
    Querystring: { limit?: string; offset?: string; unread?: string }
  }>) => {
    const agent = request.agent;
    const human = request.human;
    const { limit = '20', offset = '0', unread } = request.query;
    const limitNum = Math.min(parseInt(limit), 100);
    const offsetNum = parseInt(offset);

    // Determine user ID and type
    const isAgent = !!agent;
    const userId = isAgent ? agent!.id : human!.id;

    // Build query based on user type
    // For agents: check userId column
    // For humans: check humanUserId column
    const userCondition = isAgent
      ? eq(notifications.userId, userId)
      : eq(notifications.humanUserId, userId);

    // Get notifications with actor info (supports both agent and human actors)
    const results = await db.execute(sql`
      SELECT
        n.id,
        n.type,
        n.target_id as "targetId",
        n.read,
        n.created_at as "createdAt",
        CASE
          WHEN n.actor_id IS NOT NULL THEN json_build_object(
            'id', a.id,
            'name', a.name,
            'type', 'agent',
            'karma', a.karma
          )
          ELSE json_build_object(
            'id', h.id,
            'name', h.username,
            'type', 'human',
            'displayName', h.display_name
          )
        END as actor
      FROM notifications n
      LEFT JOIN agents a ON n.actor_id = a.id
      LEFT JOIN humans h ON n.actor_human_id = h.id
      WHERE ${isAgent ? sql`n.user_id = ${userId}` : sql`n.human_user_id = ${userId}`}
        ${unread === 'true' ? sql`AND n.read = false` : sql``}
      ORDER BY n.created_at DESC
      LIMIT ${limitNum}
      OFFSET ${offsetNum}
    `);

    // Get counts
    const [counts] = await db.execute(sql`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE read = false)::int as unread
      FROM notifications
      WHERE ${isAgent ? sql`user_id = ${userId}` : sql`human_user_id = ${userId}`}
    `);

    const totalCount = (counts as any)?.total || 0;
    const unreadCount = (counts as any)?.unread || 0;

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
   * Mark notification as read (agents or humans)
   */
  app.patch<{ Params: { id: string } }>('/:id/read', { preHandler: authenticateUnified }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const agent = request.agent;
    const human = request.human;
    const { id } = request.params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      throw new ValidationError('Invalid notification ID format');
    }

    const userId = agent?.id || human?.id;
    const isAgent = !!agent;

    // Find notification
    const [notification] = await db.select().from(notifications)
      .where(eq(notifications.id, id))
      .limit(1);

    if (!notification) {
      throw new NotFoundError('Notification');
    }

    // Check ownership (agent or human)
    const isOwner = isAgent
      ? notification.userId === userId
      : notification.humanUserId === userId;

    if (!isOwner) {
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
   * Mark all notifications as read (agents or humans)
   */
  app.patch('/read-all', { preHandler: authenticateUnified }, async (request) => {
    const agent = request.agent;
    const human = request.human;
    const userId = agent?.id || human?.id;
    const isAgent = !!agent;

    // Mark all as read based on user type
    if (isAgent) {
      await db.update(notifications)
        .set({ read: true })
        .where(and(
          eq(notifications.userId, userId!),
          eq(notifications.read, false)
        ));
    } else {
      await db.update(notifications)
        .set({ read: true })
        .where(and(
          eq(notifications.humanUserId, userId!),
          eq(notifications.read, false)
        ));
    }

    return {
      success: true,
      message: 'All notifications marked as read',
    };
  });

  /**
   * DELETE /api/notifications/:id
   * Delete notification (agents or humans)
   */
  app.delete<{ Params: { id: string } }>('/:id', { preHandler: authenticateUnified }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const agent = request.agent;
    const human = request.human;
    const { id } = request.params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      throw new ValidationError('Invalid notification ID format');
    }

    const userId = agent?.id || human?.id;
    const isAgent = !!agent;

    // Find notification
    const [notification] = await db.select().from(notifications)
      .where(eq(notifications.id, id))
      .limit(1);

    if (!notification) {
      throw new NotFoundError('Notification');
    }

    // Check ownership (agent or human)
    const isOwner = isAgent
      ? notification.userId === userId
      : notification.humanUserId === userId;

    if (!isOwner) {
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
   * Get unread notification count (for badge) - agents or humans
   */
  app.get('/unread-count', { preHandler: authenticateUnified }, async (request) => {
    const agent = request.agent;
    const human = request.human;
    const userId = agent?.id || human?.id;
    const isAgent = !!agent;

    let countResult;
    if (isAgent) {
      [countResult] = await db.select({ count: sql<number>`count(*)` })
        .from(notifications)
        .where(and(
          eq(notifications.userId, userId!),
          eq(notifications.read, false)
        ));
    } else {
      [countResult] = await db.select({ count: sql<number>`count(*)` })
        .from(notifications)
        .where(and(
          eq(notifications.humanUserId, userId!),
          eq(notifications.read, false)
        ));
    }

    return {
      success: true,
      count: Number(countResult?.count || 0),
    };
  });
}
