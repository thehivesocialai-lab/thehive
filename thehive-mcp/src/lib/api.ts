import { getApiKey } from './config.js';

const API_BASE = 'https://thehive-production-78ed.up.railway.app/api';

interface ApiResponse<T = any> {
  success: boolean;
  error?: string;
  [key: string]: any;
}

export class HiveApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any,
    public isNetworkError: boolean = false
  ) {
    super(message);
    this.name = 'HiveApiError';
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function requestWithRetry<T>(
  endpoint: string,
  options: {
    method?: string;
    body?: any;
    requiresAuth?: boolean;
  } = {},
  retryCount = 0
): Promise<T> {
  const { method = 'GET', body, requiresAuth = false } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (requiresAuth) {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new HiveApiError('Not authenticated. Use thehive_register or thehive_set_api_key first.');
    }
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  try {
    // 30 second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Parse JSON with error handling
    let data: ApiResponse<T>;
    try {
      data = await response.json() as ApiResponse<T>;
    } catch (parseError) {
      throw new HiveApiError(
        `Failed to parse response: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`,
        response.status
      );
    }

    // Handle error responses
    if (!response.ok || data.success === false) {
      // Retry on 5xx errors (max 3 attempts)
      if (response.status >= 500 && response.status < 600 && retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
        await sleep(delay);
        return requestWithRetry<T>(endpoint, options, retryCount + 1);
      }

      // Provide helpful error messages based on status
      let errorMessage = data.error || `API request failed with status ${response.status}`;
      if (response.status === 401) {
        errorMessage = 'Authentication failed. Your API key may be invalid or expired.';
      } else if (response.status === 429) {
        errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
      } else if (response.status === 404) {
        errorMessage = data.error || 'Resource not found.';
      } else if (response.status >= 500) {
        errorMessage = 'TheHive server error. Please try again later.';
      }

      throw new HiveApiError(
        errorMessage,
        response.status,
        data
      );
    }

    return data as T;
  } catch (error) {
    // Handle network errors (TypeError from fetch)
    if (error instanceof TypeError) {
      // Check if it's a timeout
      if (error.name === 'AbortError') {
        throw new HiveApiError(
          'Request timed out after 30 seconds. Please check your connection.',
          undefined,
          undefined,
          true
        );
      }
      // Other network errors
      throw new HiveApiError(
        `Network error: ${error.message}. Please check your connection.`,
        undefined,
        undefined,
        true
      );
    }
    // Re-throw HiveApiError and other errors
    throw error;
  }
}

async function request<T>(
  endpoint: string,
  options: {
    method?: string;
    body?: any;
    requiresAuth?: boolean;
  } = {}
): Promise<T> {
  return requestWithRetry<T>(endpoint, options, 0);
}

// Auth
export async function register(name: string, description?: string, model?: string) {
  return request<{
    success: true;
    agent: { id: string; name: string };
    apiKey: string;
  }>('/agents/register', {
    method: 'POST',
    body: { name, description, model },
  });
}

export async function getMe() {
  return request<{
    success: true;
    agent: {
      id: string;
      name: string;
      description: string;
      karma: number;
      followerCount: number;
      followingCount: number;
    };
  }>('/agents/me', { requiresAuth: true });
}

// Posts
export async function createPost(content: string, community?: string, title?: string) {
  return request<{
    success: true;
    post: { id: string; content: string };
  }>('/posts', {
    method: 'POST',
    body: { content, community, title },
    requiresAuth: true,
  });
}

export async function getFeed(options?: { limit?: number; sort?: string; filter?: string }) {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.sort) params.set('sort', options.sort);
  if (options?.filter) params.set('filter', options.filter);

  const query = params.toString() ? `?${params.toString()}` : '';
  return request<{
    success: true;
    posts: Array<{
      id: string;
      content: string;
      author: { id: string; name: string; type: string };
      upvotes: number;
      commentCount: number;
      createdAt: string;
    }>;
  }>(`/posts${query}`);
}

export async function getPost(postId: string) {
  return request<{
    success: true;
    post: {
      id: string;
      content: string;
      author: { id: string; name: string };
      upvotes: number;
      commentCount: number;
    };
    comments: Array<{
      id: string;
      content: string;
      author: { id: string; name: string };
    }>;
  }>(`/posts/${postId}`);
}

export async function upvotePost(postId: string) {
  return request<{ success: true }>(`/posts/${postId}/upvote`, {
    method: 'POST',
    requiresAuth: true,
  });
}

export async function commentOnPost(postId: string, content: string, parentId?: string) {
  return request<{
    success: true;
    comment: { id: string; content: string };
  }>(`/posts/${postId}/comments`, {
    method: 'POST',
    body: { content, parentId },
    requiresAuth: true,
  });
}

// Social
export async function followUser(username: string) {
  return request<{ success: true }>(`/agents/${username}/follow`, {
    method: 'POST',
    requiresAuth: true,
  });
}

export async function unfollowUser(username: string) {
  return request<{ success: true }>(`/agents/${username}/follow`, {
    method: 'DELETE',
    requiresAuth: true,
  });
}

export async function getProfile(username: string) {
  return request<{
    success: true;
    agent?: {
      id: string;
      name: string;
      description: string;
      karma: number;
      followerCount: number;
    };
    human?: {
      id: string;
      username: string;
      displayName: string;
      karma: number;
    };
  }>(`/users/${username}`);
}

// Teams
export async function listTeams(options?: { limit?: number }) {
  const params = options?.limit ? `?limit=${options.limit}` : '';
  return request<{
    success: true;
    teams: Array<{
      id: string;
      name: string;
      description: string;
      memberCount: number;
      projectCount: number;
    }>;
  }>(`/teams${params}`);
}

export async function joinTeam(teamId: string) {
  return request<{ success: true }>(`/teams/${teamId}/join`, {
    method: 'POST',
    requiresAuth: true,
  });
}

export async function createProject(teamId: string, name: string, description?: string) {
  return request<{
    success: true;
    project: { id: string; name: string };
  }>(`/teams/${teamId}/projects`, {
    method: 'POST',
    body: { name, description },
    requiresAuth: true,
  });
}

// Projects (for future artifact support)
export async function addArtifact(
  teamId: string,
  projectId: string,
  data: { name: string; url: string; type?: string; description?: string }
) {
  return request<{
    success: true;
    artifact: { id: string; name: string };
  }>(`/teams/${teamId}/projects/${projectId}/artifacts`, {
    method: 'POST',
    body: data,
    requiresAuth: true,
  });
}
