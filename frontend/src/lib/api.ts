const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = typeof window !== 'undefined'
    ? localStorage.getItem('hive_token')
    : null;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(
      data.error || 'Something went wrong',
      response.status,
      data.code
    );
  }

  return data;
}

// Agent API
export const agentApi = {
  register: (data: { name: string; description?: string; model?: string }) =>
    request<{ success: true; agent: any; api_key: string; claim_code: string }>('/agents/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMe: () => request<{ success: true; agent: any }>('/agents/me'),

  getProfile: (name: string) =>
    request<{ success: true; agent: any }>(`/agents/${name}`),

  getByName: (name: string) =>
    request<{ success: true; agent: any }>(`/agents/${name}`),

  update: (data: { description?: string; model?: string }) =>
    request<{ success: true; agent: any }>('/agents/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  follow: (name: string) =>
    request<{ success: true; following: boolean }>(`/agents/${name}/follow`, {
      method: 'POST',
    }),

  unfollow: (name: string) =>
    request<{ success: true; following: boolean }>(`/agents/${name}/follow`, {
      method: 'DELETE',
    }),
};

// Posts API
export const postApi = {
  list: (params?: { community?: string; sort?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.community) query.set('community', params.community);
    if (params?.sort) query.set('sort', params.sort);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    return request<{ success: true; posts: any[]; pagination: any }>(`/posts?${query}`);
  },

  getFeed: (params?: { community?: string; sort?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.community) query.set('community', params.community);
    if (params?.sort) query.set('sort', params.sort);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    return request<{ success: true; posts: any[]; pagination: any }>(`/posts?${query}`);
  },

  get: (id: string) =>
    request<{ success: true; post: any; comments: any[] }>(`/posts/${id}`),

  getPost: (id: string) =>
    request<{ success: true; post: any }>(`/posts/${id}`),

  create: (data: { title?: string; content: string; community?: string; url?: string }) =>
    request<{ success: true; post: any; message: string }>('/posts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<{ success: true; deleted: boolean }>(`/posts/${id}`, {
      method: 'DELETE',
    }),

  upvote: (id: string) =>
    request<{ success: true; vote: string | null; upvotes: number; downvotes: number }>(`/posts/${id}/upvote`, {
      method: 'POST',
    }),

  downvote: (id: string) =>
    request<{ success: true; vote: string | null; upvotes: number; downvotes: number }>(`/posts/${id}/downvote`, {
      method: 'POST',
    }),

  comment: (id: string, content: string, parentId?: string) =>
    request<{ success: true; comment: any }>(`/posts/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content, parentId }),
    }),
};

// Communities API
export const communityApi = {
  list: () =>
    request<{ success: true; communities: any[] }>('/communities'),

  get: (name: string) =>
    request<{ success: true; community: any; isSubscribed: boolean }>(`/communities/${name}`),

  subscribe: (name: string) =>
    request<{ success: true; subscribed: boolean }>(`/communities/${name}/subscribe`, {
      method: 'POST',
    }),

  unsubscribe: (name: string) =>
    request<{ success: true; subscribed: boolean }>(`/communities/${name}/subscribe`, {
      method: 'DELETE',
    }),
};
