import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { eq, and, or, desc, sql } from 'drizzle-orm';
import { db, messages, agents, humans } from '../db';
import { authenticateUnified } from '../middleware/auth';
import { NotFoundError, ValidationError, ForbiddenError } from '../lib/errors';

// Validation schemas
const sendMessageSchema = z.object({
  recipientId: z.string().uuid('Invalid recipient ID'),
  recipientType: z.enum(['agent', 'human']),
  content: z.string().min(1, 'Message cannot be empty').max(2000, 'Message too long'),
});

export async function messageRoutes(app: FastifyInstance) {
  /**
   * GET /api/messages
   * Get all conversations (grouped by other party)
   */
  app.get('/', {
    preHandler: authenticateUnified,
  }, async (request: FastifyRequest) => {
    const user = (request as any).user;
    const userId = user.id;
    const userType = user.type as 'agent' | 'human';

    // Get distinct conversations with latest message
    const isAgent = userType === 'agent';

    // Get all messages where user is sender or recipient
    const userMessages = await db.select()
      .from(messages)
      .where(
        isAgent
          ? or(eq(messages.senderAgentId, userId), eq(messages.recipientAgentId, userId))
          : or(eq(messages.senderHumanId, userId), eq(messages.recipientHumanId, userId))
      )
      .orderBy(desc(messages.createdAt))
      .limit(100);

    // Group by conversation partner
    const conversationMap = new Map<string, any>();

    for (const msg of userMessages) {
      // Determine the other party
      let otherId: string;
      let otherType: 'agent' | 'human';

      if (isAgent) {
        if (msg.senderAgentId === userId) {
          // We sent this message
          otherId = msg.recipientAgentId || msg.recipientHumanId!;
          otherType = msg.recipientAgentId ? 'agent' : 'human';
        } else {
          // We received this message
          otherId = msg.senderAgentId || msg.senderHumanId!;
          otherType = msg.senderAgentId ? 'agent' : 'human';
        }
      } else {
        if (msg.senderHumanId === userId) {
          otherId = msg.recipientAgentId || msg.recipientHumanId!;
          otherType = msg.recipientAgentId ? 'agent' : 'human';
        } else {
          otherId = msg.senderAgentId || msg.senderHumanId!;
          otherType = msg.senderAgentId ? 'agent' : 'human';
        }
      }

      const key = `${otherType}:${otherId}`;

      if (!conversationMap.has(key)) {
        conversationMap.set(key, {
          partnerId: otherId,
          partnerType: otherType,
          lastMessage: msg,
          unreadCount: 0,
        });
      }

      // Count unread messages from this partner
      const isFromPartner = (isAgent && (msg.senderAgentId === otherId || msg.senderHumanId === otherId)) ||
                           (!isAgent && (msg.senderAgentId === otherId || msg.senderHumanId === otherId));
      if (isFromPartner && !msg.read) {
        const conv = conversationMap.get(key);
        conv.unreadCount++;
      }
    }

    // Get partner details
    const conversations = [];
    for (const [_, conv] of conversationMap) {
      let partner;
      if (conv.partnerType === 'agent') {
        const [agent] = await db.select({
          id: agents.id,
          name: agents.name,
          description: agents.description,
        }).from(agents).where(eq(agents.id, conv.partnerId));
        partner = agent ? { ...agent, type: 'agent' } : null;
      } else {
        const [human] = await db.select({
          id: humans.id,
          username: humans.username,
          displayName: humans.displayName,
        }).from(humans).where(eq(humans.id, conv.partnerId));
        partner = human ? { ...human, name: human.displayName || human.username, type: 'human' } : null;
      }

      if (partner) {
        conversations.push({
          partner,
          lastMessage: {
            content: conv.lastMessage.content,
            createdAt: conv.lastMessage.createdAt,
            isMine: (isAgent && conv.lastMessage.senderAgentId === userId) ||
                   (!isAgent && conv.lastMessage.senderHumanId === userId),
          },
          unreadCount: conv.unreadCount,
        });
      }
    }

    return {
      success: true,
      conversations,
    };
  });

  /**
   * GET /api/messages/:partnerId
   * Get messages with a specific user
   */
  app.get<{
    Params: { partnerId: string };
    Querystring: { partnerType?: string; limit?: string; offset?: string };
  }>('/:partnerId', {
    preHandler: authenticateUnified,
  }, async (request) => {
    const user = (request as any).user;
    const userId = user.id;
    const userType = user.type as 'agent' | 'human';
    const { partnerId } = request.params;
    const { partnerType = 'agent', limit = '50', offset = '0' } = request.query;

    const limitNum = Math.min(parseInt(limit), 100);
    const offsetNum = parseInt(offset);
    const isAgent = userType === 'agent';
    const partnerIsAgent = partnerType === 'agent';

    // Build query conditions
    let condition;
    if (isAgent && partnerIsAgent) {
      condition = or(
        and(eq(messages.senderAgentId, userId), eq(messages.recipientAgentId, partnerId)),
        and(eq(messages.senderAgentId, partnerId), eq(messages.recipientAgentId, userId))
      );
    } else if (isAgent && !partnerIsAgent) {
      condition = or(
        and(eq(messages.senderAgentId, userId), eq(messages.recipientHumanId, partnerId)),
        and(eq(messages.senderHumanId, partnerId), eq(messages.recipientAgentId, userId))
      );
    } else if (!isAgent && partnerIsAgent) {
      condition = or(
        and(eq(messages.senderHumanId, userId), eq(messages.recipientAgentId, partnerId)),
        and(eq(messages.senderAgentId, partnerId), eq(messages.recipientHumanId, userId))
      );
    } else {
      condition = or(
        and(eq(messages.senderHumanId, userId), eq(messages.recipientHumanId, partnerId)),
        and(eq(messages.senderHumanId, partnerId), eq(messages.recipientHumanId, userId))
      );
    }

    const messagesList = await db.select()
      .from(messages)
      .where(condition)
      .orderBy(desc(messages.createdAt))
      .limit(limitNum)
      .offset(offsetNum);

    // Mark messages as read
    const unreadIds = messagesList
      .filter(m => !m.read && (
        (isAgent && (m.senderAgentId === partnerId || m.senderHumanId === partnerId)) ||
        (!isAgent && (m.senderAgentId === partnerId || m.senderHumanId === partnerId))
      ))
      .map(m => m.id);

    if (unreadIds.length > 0) {
      await db.update(messages)
        .set({ read: true })
        .where(sql`id = ANY(${unreadIds})`);
    }

    // Get partner info
    let partner;
    if (partnerIsAgent) {
      const [agent] = await db.select({
        id: agents.id,
        name: agents.name,
        description: agents.description,
      }).from(agents).where(eq(agents.id, partnerId));
      partner = agent ? { ...agent, type: 'agent' } : null;
    } else {
      const [human] = await db.select({
        id: humans.id,
        username: humans.username,
        displayName: humans.displayName,
      }).from(humans).where(eq(humans.id, partnerId));
      partner = human ? { ...human, name: human.displayName || human.username, type: 'human' } : null;
    }

    return {
      success: true,
      partner,
      messages: messagesList.map(m => ({
        id: m.id,
        content: m.content,
        createdAt: m.createdAt,
        read: m.read,
        isMine: (isAgent && m.senderAgentId === userId) ||
               (!isAgent && m.senderHumanId === userId),
      })).reverse(), // Chronological order
    };
  });

  /**
   * POST /api/messages
   * Send a message
   */
  app.post('/', {
    preHandler: authenticateUnified,
    config: {
      rateLimit: {
        max: 30,
        timeWindow: 60000, // 30 messages per minute
      },
    },
  }, async (request: FastifyRequest<{ Body: z.infer<typeof sendMessageSchema> }>) => {
    const user = (request as any).user;
    const userId = user.id;
    const userType = user.type as 'agent' | 'human';

    const body = sendMessageSchema.parse(request.body);
    const { recipientId, recipientType, content } = body;

    // Verify recipient exists
    if (recipientType === 'agent') {
      const [agent] = await db.select({ id: agents.id }).from(agents).where(eq(agents.id, recipientId));
      if (!agent) throw new NotFoundError('Recipient not found');
    } else {
      const [human] = await db.select({ id: humans.id }).from(humans).where(eq(humans.id, recipientId));
      if (!human) throw new NotFoundError('Recipient not found');
    }

    // Can't message yourself
    if (userId === recipientId && userType === recipientType) {
      throw new ValidationError('Cannot message yourself');
    }

    // Create message
    const messageData: any = {
      content,
      read: false,
    };

    if (userType === 'agent') {
      messageData.senderAgentId = userId;
    } else {
      messageData.senderHumanId = userId;
    }

    if (recipientType === 'agent') {
      messageData.recipientAgentId = recipientId;
    } else {
      messageData.recipientHumanId = recipientId;
    }

    const [newMessage] = await db.insert(messages).values(messageData).returning();

    return {
      success: true,
      message: {
        id: newMessage.id,
        content: newMessage.content,
        createdAt: newMessage.createdAt,
        isMine: true,
      },
    };
  });

  /**
   * GET /api/messages/unread
   * Get unread message count
   */
  app.get('/unread/count', {
    preHandler: authenticateUnified,
  }, async (request: FastifyRequest) => {
    const user = (request as any).user;
    const userId = user.id;
    const userType = user.type as 'agent' | 'human';
    const isAgent = userType === 'agent';

    const [{ count }] = await db.select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(
        and(
          isAgent
            ? eq(messages.recipientAgentId, userId)
            : eq(messages.recipientHumanId, userId),
          eq(messages.read, false)
        )
      );

    return {
      success: true,
      count: Number(count),
    };
  });
}
