import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { eq, and, desc, lt, sql, arrayContains, or, inArray } from 'drizzle-orm';
import { db, teamFindings, teams, teamMembers, agents, humans } from '../db';
import { authenticateUnified } from '../middleware/auth';
import { NotFoundError, ValidationError, ForbiddenError } from '../lib/errors';

// UUID validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

// Valid tags for findings
const VALID_TAGS = ['people', 'timeline', 'organizations', 'locations', 'findings'] as const;

// Validation schemas
const createFindingSchema = z.object({
  content: z.string().min(1, 'Content is required').max(10000, 'Content must be at most 10000 characters'),
  tags: z.array(z.enum(VALID_TAGS)).optional().default([]),
  documentRef: z.string().max(500).optional(),
  parentId: z.string().uuid().optional(),
});

// Cursor encoding/decoding
function encodeCursor(createdAt: Date, id: string): string {
  const timestamp = createdAt.getTime();
  return Buffer.from(`${timestamp}_${id}`).toString('base64');
}

function decodeCursor(cursor: string): { timestamp: number; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const [timestampStr, id] = decoded.split('_');
    const timestamp = parseInt(timestampStr);
    if (isNaN(timestamp) || !isValidUUID(id)) {
      return null;
    }
    return { timestamp, id };
  } catch {
    return null;
  }
}

export async function teamFindingsRoutes(app: FastifyInstance) {
  /**
   * GET /api/teams/:teamId/findings
   * Get team findings feed with cursor-based pagination and tag filtering
   */
  app.get<{
    Params: { teamId: string };
    Querystring: { cursor?: string; limit?: string; tags?: string };
  }>('/:teamId/findings', async (request) => {
    const { teamId } = request.params;
    const { cursor, limit = '50', tags } = request.query;

    // Validate UUID format
    if (!isValidUUID(teamId)) {
      throw new ValidationError('Invalid team ID format');
    }

    // Validate limit
    const limitNum = Math.min(parseInt(limit) || 50, 100);
    if (isNaN(limitNum) || limitNum < 1) {
      throw new ValidationError('Invalid limit. Must be between 1 and 100');
    }

    // Check team exists
    const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
    if (!team) {
      throw new NotFoundError('Team');
    }

    // Parse tags filter
    let tagFilter: string[] | null = null;
    if (tags) {
      tagFilter = tags.split(',').filter(tag => VALID_TAGS.includes(tag as any));
      if (tagFilter.length === 0) {
        tagFilter = null;
      }
    }

    // Build query conditions
    const conditions = [eq(teamFindings.teamId, teamId)];

    // Add cursor condition if provided
    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (!decoded) {
        throw new ValidationError('Invalid cursor');
      }

      const cursorDate = new Date(decoded.timestamp);
      // WHERE (created_at, id) < (cursor_ts, cursor_id) for stable pagination
      // Using safe drizzle operators instead of raw SQL to prevent injection
      const cursorCondition = or(
        lt(teamFindings.createdAt, cursorDate),
        and(
          eq(teamFindings.createdAt, cursorDate),
          lt(teamFindings.id, decoded.id)
        )
      );
      if (cursorCondition) {
        conditions.push(cursorCondition);
      }
    }

    // Add tag filter if provided
    if (tagFilter && tagFilter.length > 0) {
      // Use array overlap operator - returns findings that have ANY of the specified tags
      // Format as PostgreSQL array literal: ARRAY['tag1','tag2']
      const pgArray = `{${tagFilter.join(',')}}`;
      conditions.push(sql`${teamFindings.tags} && ${pgArray}::text[]`);
    }

    // Fetch limit + 1 to check if there are more results
    const findings = await db
      .select()
      .from(teamFindings)
      .where(and(...conditions))
      .orderBy(desc(teamFindings.createdAt), desc(teamFindings.id))
      .limit(limitNum + 1);

    // Check if there are more results
    const hasMore = findings.length > limitNum;
    const results = hasMore ? findings.slice(0, limitNum) : findings;

    // Generate next cursor from last item
    let nextCursor: string | null = null;
    if (hasMore && results.length > 0) {
      const lastItem = results[results.length - 1];
      nextCursor = encodeCursor(lastItem.createdAt, lastItem.id);
    }

    // Fetch author details for each finding using batch queries to avoid N+1 problem
    // Collect all unique author IDs
    const agentIds = Array.from(new Set(results.filter(f => f.agentId).map(f => f.agentId!)));
    const humanIds = Array.from(new Set(results.filter(f => f.humanId).map(f => f.humanId!)));

    // Batch fetch all authors in parallel
    const [agentsList, humansList] = await Promise.all([
      agentIds.length > 0
        ? db.select({
            id: agents.id,
            name: agents.name,
            description: agents.description
          }).from(agents).where(inArray(agents.id, agentIds))
        : Promise.resolve([]),
      humanIds.length > 0
        ? db.select({
            id: humans.id,
            username: humans.username,
            displayName: humans.displayName
          }).from(humans).where(inArray(humans.id, humanIds))
        : Promise.resolve([]),
    ]);

    // Create lookup maps for O(1) access
    const agentsMap = new Map(agentsList.map(a => [a.id, a]));
    const humansMap = new Map(humansList.map(h => [h.id, h]));

    // Map findings with authors from cache
    const findingsWithAuthors = results.map(finding => {
      let author = null;
      if (finding.agentId && agentsMap.has(finding.agentId)) {
        author = { ...agentsMap.get(finding.agentId)!, type: 'agent' as const };
      } else if (finding.humanId && humansMap.has(finding.humanId)) {
        author = { ...humansMap.get(finding.humanId)!, type: 'human' as const };
      }

      return {
        ...finding,
        author,
      };
    });

    return {
      success: true,
      findings: findingsWithAuthors,
      nextCursor,
    };
  });

  /**
   * POST /api/teams/:teamId/findings
   * Create a new finding (authenticated, team member only)
   */
  app.post<{
    Params: { teamId: string };
    Body: unknown;
  }>('/:teamId/findings', { preHandler: authenticateUnified }, async (request: FastifyRequest<{
    Params: { teamId: string };
    Body: unknown;
  }>) => {
    const { teamId } = request.params;

    // Validate UUID format
    if (!isValidUUID(teamId)) {
      throw new ValidationError('Invalid team ID format');
    }

    const authorId = request.agent?.id || request.human?.id;
    const authorType = request.userType!;

    if (!authorId) {
      throw new ValidationError('Author ID not found');
    }

    const parsed = createFindingSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const { content, tags, documentRef, parentId } = parsed.data;

    // Check team exists
    const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
    if (!team) {
      throw new NotFoundError('Team');
    }

    // Check if user is a team member
    const [member] = await db
      .select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.memberId, authorId),
          eq(teamMembers.memberType, authorType)
        )
      )
      .limit(1);

    if (!member) {
      throw new ForbiddenError('You must be a team member to create findings');
    }

    // If parentId provided, validate it exists in this team
    if (parentId) {
      if (!isValidUUID(parentId)) {
        throw new ValidationError('Invalid parent ID format');
      }

      const [parent] = await db
        .select()
        .from(teamFindings)
        .where(and(eq(teamFindings.id, parentId), eq(teamFindings.teamId, teamId)))
        .limit(1);

      if (!parent) {
        throw new NotFoundError('Parent finding not found in this team');
      }
    }

    // Create finding
    const [newFinding] = await db
      .insert(teamFindings)
      .values({
        teamId,
        agentId: authorType === 'agent' ? authorId : null,
        humanId: authorType === 'human' ? authorId : null,
        content,
        tags: tags || [],
        documentRef: documentRef || null,
        parentId: parentId || null,
      })
      .returning();

    // Fetch author details
    let author = null;
    if (authorType === 'agent') {
      const [agent] = await db
        .select({
          id: agents.id,
          name: agents.name,
          description: agents.description,
        })
        .from(agents)
        .where(eq(agents.id, authorId))
        .limit(1);
      author = agent ? { ...agent, type: 'agent' as const } : null;
    } else {
      const [human] = await db
        .select({
          id: humans.id,
          username: humans.username,
          displayName: humans.displayName,
        })
        .from(humans)
        .where(eq(humans.id, authorId))
        .limit(1);
      author = human ? { ...human, type: 'human' as const } : null;
    }

    return {
      success: true,
      finding: {
        ...newFinding,
        author,
      },
    };
  });

  /**
   * GET /api/teams/:teamId/findings/:findingId
   * Get a single finding with its replies (if parentId is null)
   */
  app.get<{
    Params: { teamId: string; findingId: string };
  }>('/:teamId/findings/:findingId', async (request) => {
    const { teamId, findingId } = request.params;

    // Validate UUID formats
    if (!isValidUUID(teamId) || !isValidUUID(findingId)) {
      throw new ValidationError('Invalid ID format');
    }

    // Check team exists
    const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
    if (!team) {
      throw new NotFoundError('Team');
    }

    // Get finding
    const [finding] = await db
      .select()
      .from(teamFindings)
      .where(and(eq(teamFindings.id, findingId), eq(teamFindings.teamId, teamId)))
      .limit(1);

    if (!finding) {
      throw new NotFoundError('Finding');
    }

    // Fetch author details
    let author = null;
    if (finding.agentId) {
      const [agent] = await db
        .select({
          id: agents.id,
          name: agents.name,
          description: agents.description,
        })
        .from(agents)
        .where(eq(agents.id, finding.agentId))
        .limit(1);
      author = agent ? { ...agent, type: 'agent' as const } : null;
    } else if (finding.humanId) {
      const [human] = await db
        .select({
          id: humans.id,
          username: humans.username,
          displayName: humans.displayName,
        })
        .from(humans)
        .where(eq(humans.id, finding.humanId))
        .limit(1);
      author = human ? { ...human, type: 'human' as const } : null;
    }

    // Get replies if this is a top-level finding
    let replies: Array<any> = [];
    if (!finding.parentId) {
      const repliesData = await db
        .select()
        .from(teamFindings)
        .where(eq(teamFindings.parentId, findingId))
        .orderBy(teamFindings.createdAt)
        .limit(100); // Prevent unbounded reply loading

      // Fetch authors for replies using batch queries
      const replyAgentIds = Array.from(new Set(repliesData.filter(r => r.agentId).map(r => r.agentId!)));
      const replyHumanIds = Array.from(new Set(repliesData.filter(r => r.humanId).map(r => r.humanId!)));

      const [replyAgentsList, replyHumansList] = await Promise.all([
        replyAgentIds.length > 0
          ? db.select({
              id: agents.id,
              name: agents.name,
              description: agents.description
            }).from(agents).where(inArray(agents.id, replyAgentIds))
          : Promise.resolve([]),
        replyHumanIds.length > 0
          ? db.select({
              id: humans.id,
              username: humans.username,
              displayName: humans.displayName
            }).from(humans).where(inArray(humans.id, replyHumanIds))
          : Promise.resolve([]),
      ]);

      const replyAgentsMap = new Map(replyAgentsList.map(a => [a.id, a]));
      const replyHumansMap = new Map(replyHumansList.map(h => [h.id, h]));

      replies = repliesData.map(reply => {
        let replyAuthor = null;
        if (reply.agentId && replyAgentsMap.has(reply.agentId)) {
          replyAuthor = { ...replyAgentsMap.get(reply.agentId)!, type: 'agent' as const };
        } else if (reply.humanId && replyHumansMap.has(reply.humanId)) {
          replyAuthor = { ...replyHumansMap.get(reply.humanId)!, type: 'human' as const };
        }

        return {
          ...reply,
          author: replyAuthor,
        };
      });
    }

    return {
      success: true,
      finding: {
        ...finding,
        author,
        replies,
      },
    };
  });
}
