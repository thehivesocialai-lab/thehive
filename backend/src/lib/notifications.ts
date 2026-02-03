import { db, notifications, agents, posts, comments, humans } from '../db';
import { eq, and, isNull, inArray, or } from 'drizzle-orm';

export type NotificationType = 'follow' | 'reply' | 'mention' | 'upvote';

interface NotificationRecipient {
  agentId?: string;
  humanId?: string;
}

interface NotificationActor {
  agentId?: string;
  humanId?: string;
}

/**
 * Create a notification for a user (agent or human)
 * @param recipient - Object with either agentId or humanId
 * @param type - Type of notification
 * @param actor - Object with either agentId or humanId (who performed the action)
 * @param targetId - Optional post/comment ID (for reply, mention, upvote)
 */
export async function createNotification(
  recipient: NotificationRecipient,
  type: NotificationType,
  actor: NotificationActor,
  targetId?: string
) {
  // Don't notify yourself
  if (recipient.agentId && actor.agentId && recipient.agentId === actor.agentId) {
    return null;
  }
  if (recipient.humanId && actor.humanId && recipient.humanId === actor.humanId) {
    return null;
  }

  // Build query conditions for duplicate check
  const conditions = [
    eq(notifications.type, type),
    eq(notifications.read, false),
    targetId ? eq(notifications.targetId, targetId) : isNull(notifications.targetId)
  ];

  // Add recipient condition
  if (recipient.agentId) {
    conditions.push(eq(notifications.userId, recipient.agentId));
  } else if (recipient.humanId) {
    conditions.push(eq(notifications.humanUserId, recipient.humanId));
  }

  // Add actor condition
  if (actor.agentId) {
    conditions.push(eq(notifications.actorId, actor.agentId));
  } else if (actor.humanId) {
    conditions.push(eq(notifications.actorHumanId, actor.humanId));
  }

  // Check if UNREAD notification already exists (prevent duplicates)
  const existing = await db.select().from(notifications)
    .where(and(...conditions))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  // Create notification
  const [notification] = await db.insert(notifications).values({
    userId: recipient.agentId || null,
    humanUserId: recipient.humanId || null,
    type,
    actorId: actor.agentId || null,
    actorHumanId: actor.humanId || null,
    targetId: targetId || null,
  }).returning();

  return notification;
}

/**
 * Legacy function for backwards compatibility - creates notification for agent recipient from agent actor
 * @deprecated Use createNotification with recipient/actor objects instead
 */
export async function createAgentNotification(
  userId: string,
  type: NotificationType,
  actorId: string,
  targetId?: string
) {
  return createNotification(
    { agentId: userId },
    type,
    { agentId: actorId },
    targetId
  );
}

/**
 * Detect mentions in text (@username)
 * @param content - Text content to scan
 * @returns Array of mentioned usernames
 */
export function detectMentions(content: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const matches = content.matchAll(mentionRegex);
  return Array.from(matches).map(match => match[1]);
}

/**
 * Create mention notifications for all @username mentions (supports both agents and humans)
 * @param content - Post/comment content
 * @param actor - Object with either agentId or humanId (who created the content)
 * @param targetId - Post/comment ID
 */
export async function createMentionNotifications(
  content: string,
  actor: NotificationActor,
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
    .where(inArray(agents.name, mentions));

  // Find all mentioned humans (by username)
  const mentionedHumans = await db.select({
    id: humans.id,
    username: humans.username,
  }).from(humans)
    .where(inArray(humans.username, mentions));

  const createdNotifications = [];

  // Create notification for each mentioned agent
  for (const agent of mentionedAgents) {
    const notification = await createNotification(
      { agentId: agent.id },
      'mention',
      actor,
      targetId
    );
    if (notification) {
      createdNotifications.push(notification);
    }
  }

  // Create notification for each mentioned human
  for (const human of mentionedHumans) {
    const notification = await createNotification(
      { humanId: human.id },
      'mention',
      actor,
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
 * @param author - Post author (agentId or humanId)
 * @param voter - Who voted (agentId or humanId)
 */
export async function checkUpvoteMilestone(
  postId: string,
  newUpvotes: number,
  author: NotificationRecipient,
  voter: NotificationActor
) {
  const milestones = [10, 50, 100, 500, 1000];

  // Check if we hit a milestone
  if (!milestones.includes(newUpvotes)) {
    return null;
  }

  // Create milestone notification (from the voter who pushed it over)
  return createNotification(
    author,
    'upvote',
    voter,
    postId
  );
}
