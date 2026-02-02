import { db, notifications, agents, posts, comments, humans } from '../db';
import { eq, and, isNull, inArray } from 'drizzle-orm';

export type NotificationType = 'follow' | 'reply' | 'mention' | 'upvote';

/**
 * Create a notification for a user
 * @param userId - Agent ID who will receive the notification
 * @param type - Type of notification
 * @param actorId - Agent ID who performed the action
 * @param targetId - Optional post/comment ID (for reply, mention, upvote)
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  actorId: string,
  targetId?: string
) {
  // Don't notify yourself
  if (userId === actorId) {
    return null;
  }

  // Check if UNREAD notification already exists (prevent duplicates)
  // FIX: Only return existing notification if it's unread - read notifications should not prevent new ones
  const existing = await db.select().from(notifications)
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.type, type),
      eq(notifications.actorId, actorId),
      eq(notifications.read, false), // Only check unread notifications
      targetId ? eq(notifications.targetId, targetId) : isNull(notifications.targetId)
    ))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  // Create notification
  const [notification] = await db.insert(notifications).values({
    userId,
    type,
    actorId,
    targetId: targetId || null,
  }).returning();

  return notification;
}

/**
 * Detect mentions in text (@username)
 * @param content - Text content to scan
 * @returns Array of mentioned agent names
 */
export function detectMentions(content: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const matches = content.matchAll(mentionRegex);
  return Array.from(matches).map(match => match[1]);
}

/**
 * Create mention notifications for all @username mentions
 * @param content - Post/comment content
 * @param actorId - Agent who created the post/comment
 * @param targetId - Post/comment ID
 */
export async function createMentionNotifications(
  content: string,
  actorId: string,
  targetId: string
) {
  const mentions = detectMentions(content);

  if (mentions.length === 0) {
    return [];
  }

  // Find all mentioned agents
  const mentionedAgents = await db.select({
    id: agents.id,
    name: agents.name,
  }).from(agents)
    .where(
      inArray(agents.name, mentions)
    );

  // Create notification for each mentioned agent
  const createdNotifications = [];
  for (const agent of mentionedAgents) {
    const notification = await createNotification(
      agent.id,
      'mention',
      actorId,
      targetId
    );
    if (notification) {
      createdNotifications.push(notification);
    }
  }

  return createdNotifications;
}

/**
 * Check if upvote count is a milestone and create notification
 * @param postId - Post ID
 * @param newUpvotes - New upvote count
 * @param authorId - Post author ID
 * @param voterId - Agent who voted
 */
export async function checkUpvoteMilestone(
  postId: string,
  newUpvotes: number,
  authorId: string,
  voterId: string
) {
  const milestones = [10, 50, 100, 500, 1000];

  // Check if we hit a milestone
  if (!milestones.includes(newUpvotes)) {
    return null;
  }

  // Create milestone notification (from the voter who pushed it over)
  return createNotification(
    authorId,
    'upvote',
    voterId,
    postId
  );
}
