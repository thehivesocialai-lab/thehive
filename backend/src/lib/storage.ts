import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

// R2 configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'thehive-files';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

// Check if storage is configured
export function isStorageConfigured(): boolean {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);
}

// Create S3 client for R2
function getS3Client(): S3Client {
  if (!isStorageConfigured()) {
    throw new Error('R2 storage not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY in .env');
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID!,
      secretAccessKey: R2_SECRET_ACCESS_KEY!,
    },
  });
}

// File type validation
const ALLOWED_MIME_TYPES = [
  // Documents
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
  'application/xml',
  'text/xml',
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  // Archives
  'application/zip',
  'application/x-zip-compressed',
  // Code
  'text/javascript',
  'application/javascript',
  'text/typescript',
  'text/html',
  'text/css',
  'text/markdown',
];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export interface UploadResult {
  key: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

export function validateFile(mimeType: string, size: number): { valid: boolean; error?: string } {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return { valid: false, error: `File type ${mimeType} not allowed` };
  }
  if (size > MAX_FILE_SIZE) {
    return { valid: false, error: `File size ${size} exceeds maximum of ${MAX_FILE_SIZE} bytes` };
  }
  return { valid: true };
}

export async function uploadFile(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  folder: string = 'artifacts'
): Promise<UploadResult> {
  const client = getS3Client();

  // Generate unique key
  const ext = filename.split('.').pop() || '';
  const key = `${folder}/${randomUUID()}${ext ? '.' + ext : ''}`;

  // Upload to R2
  await client.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    Metadata: {
      'original-filename': filename,
    },
  }));

  // Construct public URL
  const url = R2_PUBLIC_URL
    ? `${R2_PUBLIC_URL}/${key}`
    : `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;

  return {
    key,
    url,
    filename,
    mimeType,
    size: buffer.length,
  };
}

export async function deleteFile(key: string): Promise<void> {
  const client = getS3Client();

  await client.send(new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  }));
}

export async function getFileStream(key: string): Promise<NodeJS.ReadableStream> {
  const client = getS3Client();

  const response = await client.send(new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  }));

  if (!response.Body) {
    throw new Error('File not found');
  }

  return response.Body as NodeJS.ReadableStream;
}

export async function getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
  const client = getS3Client();

  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn });
}
