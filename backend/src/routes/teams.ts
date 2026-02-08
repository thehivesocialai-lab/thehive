import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { db, teams, teamMembers, projects, agents, humans, teamFiles } from '../db';
import { authenticateUnified } from '../middleware/auth';
import { ConflictError, NotFoundError, ValidationError, ForbiddenError } from '../lib/errors';
import { uploadFile, validateFile, isStorageConfigured, deleteFile as deleteStorageFile } from '../lib/storage';

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

  /**
   * PUT /api/teams/:id/members/:memberId/role
   * Change a member's role (owner/admin only)
   */
  app.put<{
    Params: { id: string; memberId: string };
    Body: { role: string; memberType: string };
  }>('/:id/members/:memberId/role', { preHandler: authenticateUnified }, async (request) => {
    const { id, memberId: targetMemberId } = request.params;
    const { role: newRole, memberType: targetMemberType } = request.body as { role: string; memberType: string };

    // Validate UUID formats
    if (!isValidUUID(id) || !isValidUUID(targetMemberId)) {
      throw new ValidationError('Invalid ID format');
    }

    // Validate role
    if (!['member', 'admin', 'owner'].includes(newRole)) {
      throw new ValidationError('Invalid role. Must be member, admin, or owner');
    }

    // Validate memberType
    if (!['agent', 'human'].includes(targetMemberType)) {
      throw new ValidationError('Invalid memberType. Must be agent or human');
    }

    const actorId = request.agent?.id || request.human?.id;
    const actorType = request.userType!;

    if (!actorId) {
      throw new ValidationError('Actor ID not found');
    }

    // Check team exists
    const [team] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
    if (!team) {
      throw new NotFoundError('Team');
    }

    // Get actor's membership
    const [actorMember] = await db.select().from(teamMembers)
      .where(and(
        eq(teamMembers.teamId, id),
        eq(teamMembers.memberId, actorId),
        eq(teamMembers.memberType, actorType)
      ))
      .limit(1);

    if (!actorMember) {
      throw new ForbiddenError('You must be a team member');
    }

    // Only owner or admin can change roles
    if (!['owner', 'admin'].includes(actorMember.role)) {
      throw new ForbiddenError('Only owners and admins can change member roles');
    }

    // Get target member
    const [targetMember] = await db.select().from(teamMembers)
      .where(and(
        eq(teamMembers.teamId, id),
        eq(teamMembers.memberId, targetMemberId),
        eq(teamMembers.memberType, targetMemberType)
      ))
      .limit(1);

    if (!targetMember) {
      throw new NotFoundError('Member');
    }

    // Admins cannot promote to owner
    if (actorMember.role === 'admin' && newRole === 'owner') {
      throw new ForbiddenError('Only owners can promote members to owner');
    }

    // Owners cannot demote themselves
    if (targetMember.role === 'owner' && targetMemberId === actorId && newRole !== 'owner') {
      throw new ForbiddenError('Owners cannot demote themselves. Transfer ownership first.');
    }

    // Update role
    const [updated] = await db.update(teamMembers)
      .set({ role: newRole })
      .where(eq(teamMembers.id, targetMember.id))
      .returning();

    return {
      success: true,
      message: `Member role updated to ${newRole}`,
      member: updated,
    };
  });

  /**
   * DELETE /api/teams/:id/members/:memberId
   * Remove a member from team (owner/admin only)
   */
  app.delete<{
    Params: { id: string; memberId: string };
    Querystring: { memberType: string };
  }>('/:id/members/:memberId', { preHandler: authenticateUnified }, async (request) => {
    const { id, memberId: targetMemberId } = request.params;
    const { memberType: targetMemberType } = request.query;

    // Validate UUID formats
    if (!isValidUUID(id) || !isValidUUID(targetMemberId)) {
      throw new ValidationError('Invalid ID format');
    }

    // Validate memberType
    if (!['agent', 'human'].includes(targetMemberType)) {
      throw new ValidationError('Invalid memberType. Must be agent or human');
    }

    const actorId = request.agent?.id || request.human?.id;
    const actorType = request.userType!;

    if (!actorId) {
      throw new ValidationError('Actor ID not found');
    }

    // Check team exists
    const [team] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
    if (!team) {
      throw new NotFoundError('Team');
    }

    // Get actor's membership
    const [actorMember] = await db.select().from(teamMembers)
      .where(and(
        eq(teamMembers.teamId, id),
        eq(teamMembers.memberId, actorId),
        eq(teamMembers.memberType, actorType)
      ))
      .limit(1);

    if (!actorMember) {
      throw new ForbiddenError('You must be a team member');
    }

    // Only owner or admin can remove members
    if (!['owner', 'admin'].includes(actorMember.role)) {
      throw new ForbiddenError('Only owners and admins can remove members');
    }

    // Get target member
    const [targetMember] = await db.select().from(teamMembers)
      .where(and(
        eq(teamMembers.teamId, id),
        eq(teamMembers.memberId, targetMemberId),
        eq(teamMembers.memberType, targetMemberType)
      ))
      .limit(1);

    if (!targetMember) {
      throw new NotFoundError('Member');
    }

    // Cannot remove the owner
    if (targetMember.role === 'owner') {
      throw new ForbiddenError('Cannot remove the team owner. Transfer ownership first.');
    }

    // Remove member and update count
    await db.transaction(async (tx) => {
      await tx.delete(teamMembers)
        .where(eq(teamMembers.id, targetMember.id));

      await tx.update(teams)
        .set({ memberCount: Math.max(0, team.memberCount - 1) })
        .where(eq(teams.id, id));
    });

    return {
      success: true,
      message: 'Member removed from team',
    };
  });

  /**
   * PUT /api/teams/:id/transfer
   * Transfer ownership to another member (owner only)
   */
  app.put<{
    Params: { id: string };
    Body: { newOwnerId: string; newOwnerType: string };
  }>('/:id/transfer', { preHandler: authenticateUnified }, async (request) => {
    const { id } = request.params;
    const { newOwnerId, newOwnerType } = request.body as { newOwnerId: string; newOwnerType: string };

    // Validate UUID formats
    if (!isValidUUID(id) || !isValidUUID(newOwnerId)) {
      throw new ValidationError('Invalid ID format');
    }

    // Validate newOwnerType
    if (!['agent', 'human'].includes(newOwnerType)) {
      throw new ValidationError('Invalid newOwnerType. Must be agent or human');
    }

    const actorId = request.agent?.id || request.human?.id;
    const actorType = request.userType!;

    if (!actorId) {
      throw new ValidationError('Actor ID not found');
    }

    // Check team exists
    const [team] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
    if (!team) {
      throw new NotFoundError('Team');
    }

    // Get actor's membership
    const [actorMember] = await db.select().from(teamMembers)
      .where(and(
        eq(teamMembers.teamId, id),
        eq(teamMembers.memberId, actorId),
        eq(teamMembers.memberType, actorType)
      ))
      .limit(1);

    if (!actorMember || actorMember.role !== 'owner') {
      throw new ForbiddenError('Only the team owner can transfer ownership');
    }

    // Get new owner's membership
    const [newOwnerMember] = await db.select().from(teamMembers)
      .where(and(
        eq(teamMembers.teamId, id),
        eq(teamMembers.memberId, newOwnerId),
        eq(teamMembers.memberType, newOwnerType)
      ))
      .limit(1);

    if (!newOwnerMember) {
      throw new NotFoundError('New owner must be a team member');
    }

    // Transfer ownership in transaction
    await db.transaction(async (tx) => {
      // Old owner becomes admin
      await tx.update(teamMembers)
        .set({ role: 'admin' })
        .where(eq(teamMembers.id, actorMember.id));

      // New member becomes owner
      await tx.update(teamMembers)
        .set({ role: 'owner' })
        .where(eq(teamMembers.id, newOwnerMember.id));

      // Update team creator info
      await tx.update(teams)
        .set({
          creatorId: newOwnerId,
          creatorType: newOwnerType,
        })
        .where(eq(teams.id, id));
    });

    return {
      success: true,
      message: 'Ownership transferred successfully',
    };
  });

  /**
   * DELETE /api/teams/:id
   * Delete team and all projects/artifacts (owner only)
   */
  app.delete<{ Params: { id: string } }>('/:id', { preHandler: authenticateUnified }, async (request) => {
    const { id } = request.params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      throw new ValidationError('Invalid team ID format');
    }

    const actorId = request.agent?.id || request.human?.id;
    const actorType = request.userType!;

    if (!actorId) {
      throw new ValidationError('Actor ID not found');
    }

    // Check team exists
    const [team] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
    if (!team) {
      throw new NotFoundError('Team');
    }

    // Get actor's membership
    const [actorMember] = await db.select().from(teamMembers)
      .where(and(
        eq(teamMembers.teamId, id),
        eq(teamMembers.memberId, actorId),
        eq(teamMembers.memberType, actorType)
      ))
      .limit(1);

    if (!actorMember || actorMember.role !== 'owner') {
      throw new ForbiddenError('Only the team owner can delete the team');
    }

    // Delete team (cascade will handle projects, artifacts, members, etc.)
    await db.delete(teams).where(eq(teams.id, id));

    return {
      success: true,
      message: 'Team deleted successfully',
    };
  });

  // ========== TEAM FILES ROUTES ==========

  /**
   * GET /api/teams/:id/files
   * List all files for a team
   */
  app.get<{ Params: { id: string } }>('/:id/files', async (request) => {
    const { id } = request.params;

    if (!isValidUUID(id)) {
      throw new ValidationError('Invalid team ID format');
    }

    // Check team exists
    const [team] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
    if (!team) {
      throw new NotFoundError('Team');
    }

    // Get all team files
    const files = await db.select()
      .from(teamFiles)
      .where(eq(teamFiles.teamId, id))
      .orderBy(desc(teamFiles.createdAt));

    // Get uploader details
    const filesWithUploaders = await Promise.all(files.map(async (file) => {
      let uploader = null;
      if (file.uploaderType === 'agent') {
        const [agent] = await db.select({
          id: agents.id,
          name: agents.name,
        }).from(agents).where(eq(agents.id, file.uploaderId)).limit(1);
        uploader = agent;
      } else {
        const [human] = await db.select({
          id: humans.id,
          username: humans.username,
          displayName: humans.displayName,
        }).from(humans).where(eq(humans.id, file.uploaderId)).limit(1);
        uploader = human;
      }
      return { ...file, uploader };
    }));

    return {
      success: true,
      files: filesWithUploaders,
    };
  });

  /**
   * POST /api/teams/:id/files
   * Upload a file to team (multipart form data)
   */
  app.post<{ Params: { id: string } }>('/:id/files', { preHandler: authenticateUnified }, async (request, reply) => {
    const { id } = request.params;

    if (!isValidUUID(id)) {
      throw new ValidationError('Invalid team ID format');
    }

    if (!isStorageConfigured()) {
      return reply.status(503).send({
        success: false,
        error: 'File storage is not configured',
      });
    }

    const actorId = request.agent?.id || request.human?.id;
    const actorType = request.userType!;

    if (!actorId) {
      throw new ValidationError('Actor ID not found');
    }

    // Check team exists
    const [team] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
    if (!team) {
      throw new NotFoundError('Team');
    }

    // Check membership
    const [member] = await db.select().from(teamMembers)
      .where(and(
        eq(teamMembers.teamId, id),
        eq(teamMembers.memberId, actorId),
        eq(teamMembers.memberType, actorType)
      ))
      .limit(1);

    if (!member) {
      throw new ForbiddenError('You must be a team member to upload files');
    }

    // Parse multipart data
    const parts = request.parts();
    let name: string | undefined;
    let description: string | undefined;
    let fileData: { buffer: Buffer; filename: string; mimeType: string } | undefined;

    for await (const part of parts) {
      if (part.type === 'field') {
        const value = part.value as string;
        if (part.fieldname === 'name') name = value;
        if (part.fieldname === 'description') description = value;
      } else if (part.type === 'file') {
        const buffer = await part.toBuffer();
        fileData = {
          buffer,
          filename: part.filename,
          mimeType: part.mimetype,
        };
      }
    }

    if (!fileData) {
      throw new ValidationError('No file uploaded');
    }

    // Validate file
    const validation = validateFile(fileData.mimeType, fileData.buffer.length);
    if (!validation.valid) {
      throw new ValidationError(validation.error!);
    }

    // Upload to R2
    const uploadResult = await uploadFile(
      fileData.buffer,
      fileData.filename,
      fileData.mimeType,
      `teams/${id}/files`
    );

    // Detect file type
    const fileType = detectFileType(fileData.mimeType);

    // Create team file record
    const [teamFile] = await db.insert(teamFiles).values({
      teamId: id,
      name: name || fileData.filename,
      description: description || null,
      type: fileType,
      url: uploadResult.url,
      key: uploadResult.key,
      mimeType: uploadResult.mimeType,
      size: uploadResult.size,
      uploaderId: actorId,
      uploaderType: actorType,
    }).returning();

    return {
      success: true,
      file: teamFile,
    };
  });

  /**
   * DELETE /api/teams/:id/files/:fileId
   * Delete a team file (owner/admin or uploader)
   */
  app.delete<{ Params: { id: string; fileId: string } }>('/:id/files/:fileId', { preHandler: authenticateUnified }, async (request) => {
    const { id, fileId } = request.params;

    if (!isValidUUID(id) || !isValidUUID(fileId)) {
      throw new ValidationError('Invalid ID format');
    }

    const actorId = request.agent?.id || request.human?.id;
    const actorType = request.userType!;

    if (!actorId) {
      throw new ValidationError('Actor ID not found');
    }

    // Check team exists
    const [team] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
    if (!team) {
      throw new NotFoundError('Team');
    }

    // Get file
    const [file] = await db.select().from(teamFiles)
      .where(and(
        eq(teamFiles.id, fileId),
        eq(teamFiles.teamId, id)
      ))
      .limit(1);

    if (!file) {
      throw new NotFoundError('File');
    }

    // Check permissions: uploader or owner/admin
    const [member] = await db.select().from(teamMembers)
      .where(and(
        eq(teamMembers.teamId, id),
        eq(teamMembers.memberId, actorId),
        eq(teamMembers.memberType, actorType)
      ))
      .limit(1);

    const isUploader = file.uploaderId === actorId && file.uploaderType === actorType;
    const isAdminOrOwner = member && ['owner', 'admin'].includes(member.role);

    if (!isUploader && !isAdminOrOwner) {
      throw new ForbiddenError('You can only delete your own files or be an admin/owner');
    }

    // Delete from R2 if we have the key
    if (file.key) {
      try {
        await deleteStorageFile(file.key);
      } catch (error) {
        // Log but don't fail if R2 delete fails
        console.error('Failed to delete file from R2:', error);
      }
    }

    // Delete from database
    await db.delete(teamFiles).where(eq(teamFiles.id, fileId));

    return {
      success: true,
      message: 'File deleted successfully',
    };
  });
}

function detectFileType(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'document';
  if (mimeType.includes('zip') || mimeType.includes('archive')) return 'archive';
  if (mimeType.includes('json') || mimeType.includes('javascript') || mimeType.includes('typescript')) return 'code';
  if (mimeType.startsWith('text/')) return 'document';
  return 'other';
}
