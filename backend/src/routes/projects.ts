import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db, projects, artifacts, projectActivity, projectComments, teamMembers, agents, humans } from '../db';
import { authenticateUnified } from '../middleware/auth';
import { NotFoundError, ValidationError, ForbiddenError } from '../lib/errors';
import { checkTeamPermission } from '../lib/permissions';

// UUID validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

// Validation schemas
const createArtifactSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().url().max(2000),
  type: z.enum(['code', 'design', 'document', 'image', 'link', 'other']),
  description: z.string().max(2000).optional(),
});

const updateArtifactSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  url: z.string().url().max(2000).optional(),
  type: z.enum(['code', 'design', 'document', 'image', 'link', 'other']).optional(),
  description: z.string().max(2000).optional(),
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

export async function projectRoutes(app: FastifyInstance) {
  /**
   * GET /api/teams/:teamId/projects/:projectId
   * Get project details with artifacts, recent activity, comment count
   */
  app.get<{
    Params: { teamId: string; projectId: string };
  }>('/:teamId/projects/:projectId', async (request) => {
    const { teamId, projectId } = request.params;

    // Validate UUID formats
    if (!isValidUUID(teamId) || !isValidUUID(projectId)) {
      throw new ValidationError('Invalid ID format');
    }

    // Get project
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

    // Get artifacts
    const projectArtifacts = await db.select({
      id: artifacts.id,
      name: artifacts.name,
      url: artifacts.url,
      type: artifacts.type,
      description: artifacts.description,
      version: artifacts.version,
      createdAt: artifacts.createdAt,
      creatorId: artifacts.creatorId,
      creatorType: artifacts.creatorType,
    })
      .from(artifacts)
      .where(eq(artifacts.projectId, projectId))
      .orderBy(desc(artifacts.createdAt));

    // Get recent activity (last 20 events)
    const activityData = await db.select({
      id: projectActivity.id,
      actorId: projectActivity.actorId,
      actorType: projectActivity.actorType,
      action: projectActivity.action,
      targetType: projectActivity.targetType,
      targetId: projectActivity.targetId,
      metadata: projectActivity.metadata,
      createdAt: projectActivity.createdAt,
    })
      .from(projectActivity)
      .where(eq(projectActivity.projectId, projectId))
      .orderBy(desc(projectActivity.createdAt))
      .limit(20);

    // Enrich activity with actor details
    const activity = await Promise.all(
      activityData.map(async (item) => {
        let actor = null;
        if (item.actorType === 'agent') {
          const [agent] = await db.select({
            id: agents.id,
            name: agents.name,
          }).from(agents).where(eq(agents.id, item.actorId)).limit(1);
          actor = agent ? { ...agent, type: 'agent' as const } : null;
        } else {
          const [human] = await db.select({
            id: humans.id,
            username: humans.username,
          }).from(humans).where(eq(humans.id, item.actorId)).limit(1);
          actor = human ? { id: human.id, name: human.username, type: 'human' as const } : null;
        }

        return {
          id: item.id,
          actor,
          action: item.action,
          targetType: item.targetType,
          targetId: item.targetId,
          metadata: item.metadata,
          createdAt: item.createdAt,
        };
      })
    );

    return {
      success: true,
      project,
      artifacts: projectArtifacts,
      activity,
      commentCount: project.commentCount,
    };
  });

  /**
   * POST /api/teams/:teamId/projects/:projectId/artifacts
   * Create artifact (team member only)
   */
  app.post<{
    Params: { teamId: string; projectId: string };
    Body: unknown;
  }>('/:teamId/projects/:projectId/artifacts', { preHandler: authenticateUnified }, async (request) => {
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

    const parsed = createArtifactSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const { name, url, type, description } = parsed.data;

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

    // Check team membership
    const [member] = await db.select().from(teamMembers)
      .where(and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.memberId, actorId),
        eq(teamMembers.memberType, actorType)
      ))
      .limit(1);

    if (!member) {
      throw new ForbiddenError('You must be a team member to add artifacts');
    }

    // Create artifact and update count
    const result = await db.transaction(async (tx) => {
      const [newArtifact] = await tx.insert(artifacts).values({
        projectId,
        name,
        url,
        type,
        description: description || null,
        creatorId: actorId,
        creatorType: actorType,
      }).returning();

      await tx.update(projects)
        .set({ artifactCount: project.artifactCount + 1 })
        .where(eq(projects.id, projectId));

      return newArtifact;
    });

    // Log activity
    await logActivity(
      projectId,
      actorId,
      actorType,
      'artifact_added',
      'artifact',
      result.id,
      { name, type }
    );

    return {
      success: true,
      artifact: result,
    };
  });

  /**
   * PATCH /api/teams/:teamId/projects/:projectId/artifacts/:artifactId
   * Update artifact (creates new version, team member only)
   */
  app.patch<{
    Params: { teamId: string; projectId: string; artifactId: string };
    Body: unknown;
  }>('/:teamId/projects/:projectId/artifacts/:artifactId', { preHandler: authenticateUnified }, async (request) => {
    const { teamId, projectId, artifactId } = request.params;

    // Validate UUID formats
    if (!isValidUUID(teamId) || !isValidUUID(projectId) || !isValidUUID(artifactId)) {
      throw new ValidationError('Invalid ID format');
    }

    const actorId = request.agent?.id || request.human?.id;
    const actorType = request.userType!;

    if (!actorId) {
      throw new ValidationError('Actor ID not found');
    }

    const parsed = updateArtifactSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const updates = parsed.data;

    // Check artifact exists and belongs to project
    const [artifact] = await db.select()
      .from(artifacts)
      .where(and(
        eq(artifacts.id, artifactId),
        eq(artifacts.projectId, projectId)
      ))
      .limit(1);

    if (!artifact) {
      throw new NotFoundError('Artifact');
    }

    // Check team membership
    const [member] = await db.select().from(teamMembers)
      .where(and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.memberId, actorId),
        eq(teamMembers.memberType, actorType)
      ))
      .limit(1);

    if (!member) {
      throw new ForbiddenError('You must be a team member to update artifacts');
    }

    // Update artifact (increment version)
    const [updated] = await db.update(artifacts)
      .set({
        ...updates,
        version: artifact.version + 1,
      })
      .where(eq(artifacts.id, artifactId))
      .returning();

    // Log activity
    await logActivity(
      projectId,
      actorId,
      actorType,
      'artifact_updated',
      'artifact',
      artifactId,
      { name: updated.name, version: updated.version }
    );

    return {
      success: true,
      artifact: updated,
    };
  });

  /**
   * DELETE /api/teams/:teamId/projects/:projectId/artifacts/:artifactId
   * Delete artifact (admin/owner only)
   */
  app.delete<{
    Params: { teamId: string; projectId: string; artifactId: string };
  }>('/:teamId/projects/:projectId/artifacts/:artifactId', { preHandler: authenticateUnified }, async (request) => {
    const { teamId, projectId, artifactId } = request.params;

    // Validate UUID formats
    if (!isValidUUID(teamId) || !isValidUUID(projectId) || !isValidUUID(artifactId)) {
      throw new ValidationError('Invalid ID format');
    }

    const actorId = request.agent?.id || request.human?.id;
    const actorType = request.userType!;

    if (!actorId) {
      throw new ValidationError('Actor ID not found');
    }

    // Check artifact exists and belongs to project
    const [artifact] = await db.select()
      .from(artifacts)
      .where(and(
        eq(artifacts.id, artifactId),
        eq(artifacts.projectId, projectId)
      ))
      .limit(1);

    if (!artifact) {
      throw new NotFoundError('Artifact');
    }

    // Check permissions (admin or owner only)
    const permission = await checkTeamPermission(teamId, actorId, actorType, 'admin');
    if (!permission.allowed) {
      throw new ForbiddenError('Only admins and owners can delete artifacts');
    }

    // Get project for count update
    const [project] = await db.select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      throw new NotFoundError('Project');
    }

    // Delete artifact and update count
    await db.transaction(async (tx) => {
      await tx.delete(artifacts).where(eq(artifacts.id, artifactId));

      await tx.update(projects)
        .set({ artifactCount: Math.max(0, project.artifactCount - 1) })
        .where(eq(projects.id, projectId));
    });

    // Log activity
    await logActivity(
      projectId,
      actorId,
      actorType,
      'artifact_deleted',
      'artifact',
      artifactId,
      { name: artifact.name }
    );

    return {
      success: true,
      message: 'Artifact deleted',
    };
  });

  /**
   * GET /api/teams/:teamId/projects/:projectId/activity
   * Get activity feed for project (paginated)
   */
  app.get<{
    Params: { teamId: string; projectId: string };
    Querystring: { limit?: string; offset?: string };
  }>('/:teamId/projects/:projectId/activity', async (request) => {
    const { teamId, projectId } = request.params;
    const { limit = '50', offset = '0' } = request.query;
    const limitNum = Math.min(parseInt(limit), 100);
    const offsetNum = parseInt(offset);

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

    // Get activity
    const activityData = await db.select({
      id: projectActivity.id,
      actorId: projectActivity.actorId,
      actorType: projectActivity.actorType,
      action: projectActivity.action,
      targetType: projectActivity.targetType,
      targetId: projectActivity.targetId,
      metadata: projectActivity.metadata,
      createdAt: projectActivity.createdAt,
    })
      .from(projectActivity)
      .where(eq(projectActivity.projectId, projectId))
      .orderBy(desc(projectActivity.createdAt))
      .limit(limitNum)
      .offset(offsetNum);

    // Enrich with actor details
    const activity = await Promise.all(
      activityData.map(async (item) => {
        let actor = null;
        if (item.actorType === 'agent') {
          const [agent] = await db.select({
            id: agents.id,
            name: agents.name,
          }).from(agents).where(eq(agents.id, item.actorId)).limit(1);
          actor = agent ? { ...agent, type: 'agent' as const } : null;
        } else {
          const [human] = await db.select({
            id: humans.id,
            username: humans.username,
          }).from(humans).where(eq(humans.id, item.actorId)).limit(1);
          actor = human ? { id: human.id, name: human.username, type: 'human' as const } : null;
        }

        return {
          id: item.id,
          actor,
          action: item.action,
          targetType: item.targetType,
          targetId: item.targetId,
          metadata: item.metadata,
          createdAt: item.createdAt,
        };
      })
    );

    return {
      success: true,
      activity,
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        hasMore: activity.length === limitNum,
      },
    };
  });
}
