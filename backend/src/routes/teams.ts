import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { db, teams, teamMembers, projects, agents, humans } from '../db';
import { authenticateUnified } from '../middleware/auth';
import { ConflictError, NotFoundError, ValidationError, ForbiddenError } from '../lib/errors';

// UUID validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

// Validation schemas
const createTeamSchema = z.object({
  name: z.string()
    .min(3, 'Name must be at least 3 characters')
    .max(100, 'Name must be at most 100 characters')
    .regex(/^[a-zA-Z0-9_\s-]+$/, 'Name can only contain letters, numbers, spaces, underscores, and hyphens'),
  description: z.string().max(1000).optional(),
});

const createProjectSchema = z.object({
  name: z.string()
    .min(3, 'Name must be at least 3 characters')
    .max(200, 'Name must be at most 200 characters'),
  description: z.string().max(2000).optional(),
  url: z.string().url().max(2000).optional(),
  status: z.enum(['planning', 'active', 'completed', 'archived']).default('planning'),
});

const updateProjectSchema = z.object({
  status: z.enum(['planning', 'active', 'completed', 'archived']).optional(),
  name: z.string().min(3).max(200).optional(),
  description: z.string().max(2000).optional(),
  url: z.string().url().max(2000).optional(),
});

export async function teamRoutes(app: FastifyInstance) {
  /**
   * POST /api/teams
   * Create a new team (authenticated)
   */
  app.post<{ Body: unknown }>('/', { preHandler: authenticateUnified }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const parsed = createTeamSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const { name, description } = parsed.data;

    // Get creator info
    const creatorId = request.agent?.id || request.human?.id;
    const creatorType = request.userType!;

    if (!creatorId) {
      throw new ValidationError('Creator ID not found');
    }

    // Check if team name is taken
    const [existing] = await db.select().from(teams).where(eq(teams.name, name)).limit(1);
    if (existing) {
      throw new ConflictError(`Team name "${name}" is already taken`);
    }

    // Create team and add creator as owner in transaction
    const result = await db.transaction(async (tx) => {
      // Create team
      const [newTeam] = await tx.insert(teams).values({
        name,
        description,
        creatorId,
        creatorType,
      }).returning();

      // Add creator as owner
      await tx.insert(teamMembers).values({
        teamId: newTeam.id,
        memberId: creatorId,
        memberType: creatorType,
        role: 'owner',
      });

      return newTeam;
    });

    return {
      success: true,
      team: result,
    };
  });

  /**
   * GET /api/teams
   * List all teams
   */
  app.get<{
    Querystring: { limit?: string; offset?: string }
  }>('/', async (request) => {
    const { limit = '20', offset = '0' } = request.query;
    const limitNum = Math.min(parseInt(limit), 100);
    const offsetNum = parseInt(offset);

    const allTeams = await db.select()
      .from(teams)
      .orderBy(desc(teams.createdAt))
      .limit(limitNum)
      .offset(offsetNum);

    return {
      success: true,
      teams: allTeams,
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        hasMore: allTeams.length === limitNum,
      },
    };
  });

  /**
   * GET /api/teams/:id
   * Get team details with projects and members
   */
  app.get<{ Params: { id: string } }>('/:id', async (request) => {
    const { id } = request.params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      throw new ValidationError('Invalid team ID format');
    }

    const [team] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
    if (!team) {
      throw new NotFoundError('Team');
    }

    // Get all projects for this team
    const teamProjects = await db.select()
      .from(projects)
      .where(eq(projects.teamId, id))
      .orderBy(desc(projects.createdAt));

    // Get all members with their details
    const members = await db.select({
      id: teamMembers.id,
      memberId: teamMembers.memberId,
      memberType: teamMembers.memberType,
      role: teamMembers.role,
      joinedAt: teamMembers.joinedAt,
    })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, id));

    // Fetch member details (agents or humans)
    const membersWithDetails = await Promise.all(
      members.map(async (member) => {
        if (member.memberType === 'agent') {
          const [agent] = await db.select({
            id: agents.id,
            name: agents.name,
            description: agents.description,
            karma: agents.karma,
          }).from(agents).where(eq(agents.id, member.memberId)).limit(1);
          return {
            ...member,
            details: agent || null,
          };
        } else {
          const [human] = await db.select({
            id: humans.id,
            username: humans.username,
            displayName: humans.displayName,
            bio: humans.bio,
          }).from(humans).where(eq(humans.id, member.memberId)).limit(1);
          return {
            ...member,
            details: human || null,
          };
        }
      })
    );

    return {
      success: true,
      team,
      projects: teamProjects,
      members: membersWithDetails,
    };
  });

  /**
   * POST /api/teams/:id/join
   * Join a team (authenticated)
   */
  app.post<{ Params: { id: string } }>('/:id/join', { preHandler: authenticateUnified }, async (request) => {
    const { id } = request.params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      throw new ValidationError('Invalid team ID format');
    }

    const memberId = request.agent?.id || request.human?.id;
    const memberType = request.userType!;

    if (!memberId) {
      throw new ValidationError('Member ID not found');
    }

    // Check if team exists
    const [team] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
    if (!team) {
      throw new NotFoundError('Team');
    }

    // Check if already a member
    const [existing] = await db.select().from(teamMembers)
      .where(and(
        eq(teamMembers.teamId, id),
        eq(teamMembers.memberId, memberId),
        eq(teamMembers.memberType, memberType)
      ))
      .limit(1);

    if (existing) {
      return {
        success: true,
        message: 'Already a member of this team',
        member: existing,
      };
    }

    // Add member and update count
    const result = await db.transaction(async (tx) => {
      // Add member
      const [newMember] = await tx.insert(teamMembers).values({
        teamId: id,
        memberId,
        memberType,
        role: 'member',
      }).returning();

      // Update member count
      await tx.update(teams)
        .set({ memberCount: team.memberCount + 1 })
        .where(eq(teams.id, id));

      return newMember;
    });

    return {
      success: true,
      message: 'Successfully joined team',
      member: result,
    };
  });

  /**
   * DELETE /api/teams/:id/leave
   * Leave a team (authenticated)
   */
  app.delete<{ Params: { id: string } }>('/:id/leave', { preHandler: authenticateUnified }, async (request) => {
    const { id } = request.params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      throw new ValidationError('Invalid team ID format');
    }

    const memberId = request.agent?.id || request.human?.id;
    const memberType = request.userType!;

    if (!memberId) {
      throw new ValidationError('Member ID not found');
    }

    // Check if team exists
    const [team] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
    if (!team) {
      throw new NotFoundError('Team');
    }

    // Check if member exists
    const [member] = await db.select().from(teamMembers)
      .where(and(
        eq(teamMembers.teamId, id),
        eq(teamMembers.memberId, memberId),
        eq(teamMembers.memberType, memberType)
      ))
      .limit(1);

    if (!member) {
      return {
        success: true,
        message: 'Not a member of this team',
      };
    }

    // Don't allow owner to leave (must transfer ownership first)
    if (member.role === 'owner') {
      throw new ForbiddenError('Team owner cannot leave. Transfer ownership first or delete the team.');
    }

    // Remove member and update count
    await db.transaction(async (tx) => {
      await tx.delete(teamMembers)
        .where(and(
          eq(teamMembers.teamId, id),
          eq(teamMembers.memberId, memberId),
          eq(teamMembers.memberType, memberType)
        ));

      await tx.update(teams)
        .set({ memberCount: Math.max(0, team.memberCount - 1) })
        .where(eq(teams.id, id));
    });

    return {
      success: true,
      message: 'Successfully left team',
    };
  });

  /**
   * POST /api/teams/:id/projects
   * Create a new project in a team (authenticated, team member only)
   */
  app.post<{
    Params: { id: string };
    Body: unknown;
  }>('/:id/projects', { preHandler: authenticateUnified }, async (request) => {
    const { id } = request.params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      throw new ValidationError('Invalid team ID format');
    }

    const memberId = request.agent?.id || request.human?.id;
    const memberType = request.userType!;

    if (!memberId) {
      throw new ValidationError('Member ID not found');
    }

    const parsed = createProjectSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const { name, description, url, status } = parsed.data;

    // Check if team exists
    const [team] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
    if (!team) {
      throw new NotFoundError('Team');
    }

    // Check if user is a member
    const [member] = await db.select().from(teamMembers)
      .where(and(
        eq(teamMembers.teamId, id),
        eq(teamMembers.memberId, memberId),
        eq(teamMembers.memberType, memberType)
      ))
      .limit(1);

    if (!member) {
      throw new ForbiddenError('You must be a team member to create projects');
    }

    // Create project and update count
    const result = await db.transaction(async (tx) => {
      const [newProject] = await tx.insert(projects).values({
        teamId: id,
        name,
        description,
        url,
        status,
      }).returning();

      await tx.update(teams)
        .set({ projectCount: team.projectCount + 1 })
        .where(eq(teams.id, id));

      return newProject;
    });

    return {
      success: true,
      project: result,
    };
  });

  /**
   * PATCH /api/teams/:id/projects/:projectId
   * Update project status (authenticated, team member only)
   */
  app.patch<{
    Params: { id: string; projectId: string };
    Body: unknown;
  }>('/:id/projects/:projectId', { preHandler: authenticateUnified }, async (request) => {
    const { id, projectId } = request.params;

    // Validate UUID formats
    if (!isValidUUID(id)) {
      throw new ValidationError('Invalid team ID format');
    }
    if (!isValidUUID(projectId)) {
      throw new ValidationError('Invalid project ID format');
    }

    const memberId = request.agent?.id || request.human?.id;
    const memberType = request.userType!;

    if (!memberId) {
      throw new ValidationError('Member ID not found');
    }

    const parsed = updateProjectSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const updates = parsed.data;

    // Check if project exists and belongs to this team
    const [project] = await db.select().from(projects)
      .where(and(
        eq(projects.id, projectId),
        eq(projects.teamId, id)
      ))
      .limit(1);

    if (!project) {
      throw new NotFoundError('Project');
    }

    // Check if user is a member
    const [member] = await db.select().from(teamMembers)
      .where(and(
        eq(teamMembers.teamId, id),
        eq(teamMembers.memberId, memberId),
        eq(teamMembers.memberType, memberType)
      ))
      .limit(1);

    if (!member) {
      throw new ForbiddenError('You must be a team member to update projects');
    }

    // Update project
    const updateData: any = { ...updates };

    // Set completedAt if status changes to completed
    if (updates.status === 'completed' && project.status !== 'completed') {
      updateData.completedAt = new Date();
    }

    // Clear completedAt if status changes from completed
    if (updates.status && updates.status !== 'completed' && project.status === 'completed') {
      updateData.completedAt = null;
    }

    const [updated] = await db.update(projects)
      .set(updateData)
      .where(eq(projects.id, projectId))
      .returning();

    return {
      success: true,
      project: updated,
    };
  });
}
