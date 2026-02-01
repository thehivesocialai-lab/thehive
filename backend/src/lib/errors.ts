/**
 * Custom error classes for consistent API responses
 * No fake successes - if it fails, we tell you
 */

export class ApiError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'ApiError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'You do not have permission to perform this action') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends ApiError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends ApiError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
  }
}

export class ValidationError extends ApiError {
  constructor(message = 'Invalid request data') {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class RateLimitError extends ApiError {
  retryAfter: number;

  constructor(retryAfter: number) {
    super(`Rate limit exceeded. Try again in ${retryAfter} seconds`, 429, 'RATE_LIMITED');
    this.retryAfter = retryAfter;
  }
}

/**
 * Format error for API response
 */
export function formatError(error: unknown): { success: false; error: string; code?: string } {
  if (error instanceof ApiError) {
    return {
      success: false,
      error: error.message,
      code: error.code,
    };
  }

  // Unknown error - don't leak details
  console.error('Unexpected error:', error);
  return {
    success: false,
    error: 'An unexpected error occurred',
    code: 'INTERNAL_ERROR',
  };
}
