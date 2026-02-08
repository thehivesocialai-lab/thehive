import { FastifyInstance, FastifyRequest } from 'fastify';
import { authenticateUnified, optionalAuthUnified } from '../middleware/auth';
import { uploadFile, validateFile, isStorageConfigured, getFileStream, deleteFile } from '../lib/storage';
import { ValidationError, ForbiddenError, NotFoundError } from '../lib/errors';
import { db, artifacts, teamMembers, projects } from '../db';
import { eq, and } from 'drizzle-orm';

// UUID validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function uploadRoutes(app: FastifyInstance) {
  // Register multipart support
  await app.register(import('@fastify/multipart'), {
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB
      files: 10, // Max 10 files per request
    },
  });

  /**
   * POST /api/upload
   * Upload a file to storage
   * Returns the file URL and metadata
   */
  app.post('/upload', { preHandler: authenticateUnified }, async (request, reply) => {
    if (!isStorageConfigured()) {
      return reply.status(503).send({
        success: false,
        error: 'File storage is not configured. Contact administrator.',
      });
    }

    const actorId = request.agent?.id || request.human?.id;
    const actorType = request.userType!;

    if (!actorId) {
      throw new ValidationError('Actor ID not found');
    }

    const data = await request.file();
    if (!data) {
      throw new ValidationError('No file uploaded');
    }

    const buffer = await data.toBuffer();
    const filename = data.filename;
    const mimeType = data.mimetype;

    // Validate file
    const validation = validateFile(mimeType, buffer.length);
    if (!validation.valid) {
      throw new ValidationError(validation.error!);
    }

    // Upload to storage
    const result = await uploadFile(buffer, filename, mimeType);

    return {
      success: true,
      file: {
        url: result.url,
        key: result.key,
        filename: result.filename,
        mimeType: result.mimeType,
        size: result.size,
      },
    };
  });

  /**
   * POST /api/upload/multiple
   * Upload multiple files at once
   */
  app.post('/upload/multiple', { preHandler: authenticateUnified }, async (request, reply) => {
    if (!isStorageConfigured()) {
      return reply.status(503).send({
        success: false,
        error: 'File storage is not configured. Contact administrator.',
      });
    }

    const actorId = request.agent?.id || request.human?.id;
    if (!actorId) {
      throw new ValidationError('Actor ID not found');
    }

    const parts = request.files();
    const results = [];

    for await (const data of parts) {
      const buffer = await data.toBuffer();
      const filename = data.filename;
      const mimeType = data.mimetype;

      // Validate file
      const validation = validateFile(mimeType, buffer.length);
      if (!validation.valid) {
        results.push({
          filename,
          success: false,
          error: validation.error,
        });
        continue;
      }

      try {
        const result = await uploadFile(buffer, filename, mimeType);
        results.push({
          filename,
          success: true,
          file: {
            url: result.url,
            key: result.key,
            mimeType: result.mimeType,
            size: result.size,
          },
        });
      } catch (error) {
        results.push({
          filename,
          success: false,
          error: error instanceof Error ? error.message : 'Upload failed',
        });
      }
    }

    return {
      success: true,
      files: results,
    };
  });

  /**
   * POST /api/upload/artifact
   * Upload a file and create an artifact in one request
   */
  app.post<{
    Body: {
      teamId: string;
      projectId: string;
      name?: string;
      description?: string;
      type?: string;
    };
  }>('/upload/artifact', { preHandler: authenticateUnified }, async (request, reply) => {
    if (!isStorageConfigured()) {
      return reply.status(503).send({
        success: false,
        error: 'File storage is not configured. Contact administrator.',
      });
    }

    const actorId = request.agent?.id || request.human?.id;
    const actorType = request.userType!;

    if (!actorId) {
      throw new ValidationError('Actor ID not found');
    }

    // Parse multipart form data
    const parts = request.parts();
    let teamId: string | undefined;
    let projectId: string | undefined;
    let name: string | undefined;
    let description: string | undefined;
    let artifactType: string | undefined;
    let fileData: { buffer: Buffer; filename: string; mimeType: string } | undefined;

    for await (const part of parts) {
      if (part.type === 'field') {
        const value = part.value as string;
        switch (part.fieldname) {
          case 'teamId': teamId = value; break;
          case 'projectId': projectId = value; break;
          case 'name': name = value; break;
          case 'description': description = value; break;
          case 'type': artifactType = value; break;
        }
      } else if (part.type === 'file') {
        const buffer = await part.toBuffer();
        fileData = {
          buffer,
          filename: part.filename,
          mimeType: part.mimetype,
        };
      }
    }

    // Validate required fields
    if (!teamId || !projectId) {
      throw new ValidationError('teamId and projectId are required');
    }

    if (!UUID_REGEX.test(teamId) || !UUID_REGEX.test(projectId)) {
      throw new ValidationError('Invalid ID format');
    }

    if (!fileData) {
      throw new ValidationError('No file uploaded');
    }

    // Validate file
    const validation = validateFile(fileData.mimeType, fileData.buffer.length);
    if (!validation.valid) {
      throw new ValidationError(validation.error!);
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

    // Upload file
    const uploadResult = await uploadFile(
      fileData.buffer,
      fileData.filename,
      fileData.mimeType,
      `artifacts/${projectId}`
    );

    // Determine artifact type from mime type if not provided
    const detectedType = artifactType || detectArtifactType(fileData.mimeType);

    // Create artifact
    const [artifact] = await db.transaction(async (tx) => {
      const [newArtifact] = await tx.insert(artifacts).values({
        projectId,
        name: name || fileData.filename,
        url: uploadResult.url,
        type: detectedType,
        description: description || null,
        creatorId: actorId,
        creatorType: actorType,
      }).returning();

      await tx.update(projects)
        .set({ artifactCount: project.artifactCount + 1 })
        .where(eq(projects.id, projectId));

      return [newArtifact];
    });

    return {
      success: true,
      artifact: {
        ...artifact,
        file: {
          key: uploadResult.key,
          mimeType: uploadResult.mimeType,
          size: uploadResult.size,
        },
      },
    };
  });

  /**
   * GET /api/files/:key
   * Proxy file download (for private files)
   */
  app.get<{
    Params: { '*': string };
  }>('/files/*', async (request, reply) => {
    const key = request.params['*'];

    if (!key) {
      throw new ValidationError('File key required');
    }

    try {
      const stream = await getFileStream(key);
      return reply.send(stream);
    } catch (error) {
      throw new NotFoundError('File');
    }
  });

  /**
   * GET /api/upload/status
   * Check if file upload is configured
   */
  app.get('/upload/status', async () => {
    return {
      success: true,
      configured: isStorageConfigured(),
      maxFileSize: 100 * 1024 * 1024,
      allowedTypes: [
        'application/pdf',
        'text/plain',
        'text/csv',
        'application/json',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/zip',
      ],
    };
  });
}

function detectArtifactType(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'document';
  if (mimeType.includes('json') || mimeType.includes('javascript') || mimeType.includes('typescript')) return 'code';
  if (mimeType.startsWith('text/')) return 'document';
  if (mimeType.includes('zip')) return 'other';
  return 'other';
}
