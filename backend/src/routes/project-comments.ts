import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { db, projects, artifacts, projectComments, artifactComments, teamMembers, agents, humans, projectActivity } from '../db';
import { authenticateUnified } from '../middleware/auth';
import { NotFoundError, ValidationError, ForbiddenError } from '../lib/errors';

// UUID validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

// Helper: Sanitize text by removing null bytes and control characters (except \n, \t, \r)
function sanitizeText(text: string): string {
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

// Validation schemas
const createCommentSchema = z.object({
  content: z.string().min(1).max(5000).transform(sanitizeText),
  parentId: z.string().uuid().optional(),
});

// Helper to log activity
async function logActivity(
  projectId: string,
  actorId: string,
  actorType: 'agent' | 'human',
  action: string,
  targetType?: string,
  targetId?: string,
  metadata?: any
) {
  await db.insert(projectActivity).values({
    projectId,
    actorId,
    actorType,
    action,
    targetType: targetType || null,
    targetId: targetId || null,
    metadata: metadata || null,
  });

  // Update project's last activity timestamp
  await db.update(projects)
    .set({ lastActivityAt: new Date() })
    .where(eq(projects.id, projectId));
}

export async function projectCommentRoutes(app: FastifyInstance) {
  /**
   * GET /api/teams/:teamId/projects/:projectId/comments
   * Get all comments for project (threaded)
   */
  app.get<{
    Params: { teamId: string; projectId: string };
  }>('/:teamId/projects/:projectId/comments', async (request) => {
    const { teamId, projectId } = request.params;

    // Validate UUID formats
    if (!isValidUUID(teamId) || !isValidUUID(projectId)) {
      throw new ValidationError('Invalid ID format');
    }

    // Check project exists
    const [project] = await db.select()
      .from(projects)
      .where(and(
        eq(projects.id, projectId),
        eq(projects.teamId, teamId)
      ))
      .limit(1);

    if (!project) {
      throw new NotFoundError('Project');
    }

    // Get all comments
    const commentsData = await db.select({
      id: projectComments.id,
      content: projectComments.content,
      parentId: projectComments.parentId,
      agentId: projectComments.agentId,
      humanId: projectComments.humanId,
      createdAt: projectComments.createdAt,
    })
      .from(projectComments)
      .where(eq(projectComments.projectId, projectId))
      .orderBy(desc(projectComments.createdAt));

    // Enrich with author details
    const comments = await Promise.all(
      commentsData.map(async (comment) => {
        let author = null;
        if (comment.agentId) {
          const [agent] = await db.select({
            id: agents.id,
            name: agents.name,
          }).from(agents).where(eq(agents.id, comment.agentId)).limit(1);
          author = agent ? { ...agent, type: 'agent' as const } : null;
        } else if (comment.humanId) {
          const [human] = await db.select({
            id: humans.id,
            username: humans.username,
          }).from(humans).where(eq(humans.id, comment.humanId)).limit(1);
          author = human ? { id: human.id, name: human.username, type: 'human' as const } : null;
        }

        return {
          id: comment.id,
          content: comment.content,
          parentId: comment.parentId,
          author,
          createdAt: comment.createdAt,
        };
      })
    );

    return {
      success: true,
      comments,
    };
  });

  /**
   * POST /api/teams/:teamId/projects/:projectId/comments
   * Add comment to project (authenticated)
   */
  app.post<{
    Params: { teamId: string; projectId: string };
    Body: unknown;
  }>('/:teamId/projects/:projectId/comments', { preHandler: authenticateUnified }, async (request, reply) => {
    const { teamId, projectId } = request.params;

    // Validate UUID formats
    if (!isValidUUID(teamId) || !isValidUUID(projectId)) {
      throw new ValidationError('Invalid ID format');
    }

    const actorId = request.agent?.id || request.human?.id;
    const actorType = request.userType!;

    if (!actorId) {
      throw new ValidationError('Actor ID not found');
    }

    const parsed = createCommentSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const { content, parentId } = parsed.data;

    // Check project exists
    const [project] = await db.select()
      .from(projects)
      .where(and(
        eq(projects.id, projectId),
        eq(projects.teamId, teamId)
      ))
      .limit(1);

    if (!project) {
      throw new NotFoundError('Project');
    }

    // Verify parent comment if specified
    if (parentId) {
      const [parent] = await db.select()
        .from(projectComments)
        .where(and(
          eq(projectComments.id, parentId),
          eq(projectComments.projectId, projectId)
        ))
        .limit(1);

      if (!parent) {
        throw new NotFoundError('Parent comment');
      }
    }

    // Create comment and update count
    const result = await db.transaction(async (tx) => {
      const [newComment] = await tx.insert(projectComments).values({
        projectId,
        agentId: request.agent?.id || null,
        humanId: request.human?.id || null,
        parentId: parentId || null,
        content,
      }).returning();

      await tx.update(projects)
        .set({ commentCount: project.commentCount + 1 })
        .where(eq(projects.id, projectId));

      return newComment;
    });

    // Log activity
    await logActivity(
      projectId,
      actorId,
      actorType,
      'comment_added',
      'comment',
      result.id
    );

    return reply.status(201).send({
      success: true,
      comment: {
        id: result.id,
        content: result.content,
        parentId: result.parentId,
        createdAt: result.createdAt,
        author: request.agent ? {
          id: request.agent.id,
          name: request.agent.name,
          type: 'agent' as const,
        } : {
          id: request.human!.id,
          name: request.human!.username,
          type: 'human' as const,
        },
      },
    });
  });

  /**
   * GET /api/artifacts/:artifactId/comments
   * Get comments on artifact
   */
  app.get<{
    Params: { artifactId: string };
  }>('/artifacts/:artifactId/comments', async (request) => {
    const { artifactId } = request.params;

    // Validate UUID format
    if (!isValidUUID(artifactId)) {
      throw new ValidationError('Invalid artifact ID format');
    }

    // Check artifact exists
    const [artifact] = await db.select()
      .from(artifacts)
      .where(eq(artifacts.id, artifactId))
      .limit(1);

    if (!artifact) {
      throw new NotFoundError('Artifact');
    }

    // Get all comments
    const commentsData = await db.select({
      id: artifactComments.id,
      content: artifactComments.content,
      parentId: artifactComments.parentId,
      agentId: artifactComments.agentId,
      humanId: artifactComments.humanId,
      createdAt: artifactComments.createdAt,
    })
      .from(artifactComments)
      .where(eq(artifactComments.artifactId, artifactId))
      .orderBy(desc(artifactComments.createdAt));

    // Enrich with author details
    const comments = await Promise.all(
      commentsData.map(async (comment) => {
        let author = null;
        if (comment.agentId) {
          const [agent] = await db.select({
            id: agents.id,
            name: agents.name,
          }).from(agents).where(eq(agents.id, comment.agentId)).limit(1);
          author = agent ? { ...agent, type: 'agent' as const } : null;
        } else if (comment.humanId) {
          const [human] = await db.select({
            id: humans.id,
            username: humans.username,
          }).from(humans).where(eq(humans.id, comment.humanId)).limit(1);
          author = human ? { id: human.id, name: human.username, type: 'human' as const } : null;
        }

        return {
          id: comment.id,
          content: comment.content,
          parentId: comment.parentId,
          author,
          createdAt: comment.createdAt,
        };
      })
    );

    return {
      success: true,
      comments,
    };
  });

  /**
   * POST /api/artifacts/:artifactId/comments
   * Add comment to artifact (authenticated)
   */
  app.post<{
    Params: { artifactId: string };
    Body: unknown;
  }>('/artifacts/:artifactId/comments', { preHandler: authenticateUnified }, async (request, reply) => {
    const { artifactId } = request.params;

    // Validate UUID format
    if (!isValidUUID(artifactId)) {
      throw new ValidationError('Invalid artifact ID format');
    }

    const actorId = request.agent?.id || request.human?.id;
    const actorType = request.userType!;

    if (!actorId) {
      throw new ValidationError('Actor ID not found');
    }

    const parsed = createCommentSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const { content, parentId } = parsed.data;

    // Check artifact exists
    const [artifact] = await db.select()
      .from(artifacts)
      .where(eq(artifacts.id, artifactId))
      .limit(1);

    if (!artifact) {
      throw new NotFoundError('Artifact');
    }

    // Verify parent comment if specified
    if (parentId) {
      const [parent] = await db.select()
        .from(artifactComments)
        .where(and(
          eq(artifactComments.id, parentId),
          eq(artifactComments.artifactId, artifactId)
        ))
        .limit(1);

      if (!parent) {
        throw new NotFoundError('Parent comment');
      }
    }

    // Create comment (no count on artifacts in this schema)
    const [result] = await db.insert(artifactComments).values({
      artifactId,
      agentId: request.agent?.id || null,
      humanId: request.human?.id || null,
      parentId: parentId || null,
      content,
    }).returning();

    // Log activity for the project
    await logActivity(
      artifact.projectId,
      actorId,
      actorType,
      'artifact_comment_added',
      'artifact',
      artifactId
    );

    return reply.status(201).send({
      success: true,
      comment: {
        id: result.id,
        content: result.content,
        parentId: result.parentId,
        createdAt: result.createdAt,
        author: request.agent ? {
          id: request.agent.id,
          name: request.agent.name,
          type: 'agent' as const,
        } : {
          id: request.human!.id,
          name: request.human!.username,
          type: 'human' as const,
        },
      },
    });
  });
}
