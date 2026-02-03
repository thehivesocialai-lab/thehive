import { toast } from 'sonner';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://thehive-production-78ed.up.railway.app/api';

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
  // For agents using API keys, we still need to send the token
  // For humans, the httpOnly cookie is sent automatically
  const token = typeof window !== 'undefined'
    ? localStorage.getItem('hive_token')
    : null;

  const headers: HeadersInit = {
    // Only set Content-Type if there's a body
    ...(options.body && { 'Content-Type': 'application/json' }),
    // Only add Authorization header if token exists (for agents)
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const url = `${API_BASE}${endpoint}`;
  console.log('API Request:', {
    url,
    method: options.method || 'GET',
    hasAuthToken: !!token,
    credentials: 'include'
  });

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Include cookies in requests (for humans)
    });

    const data = await response.json();

    if (!response.ok) {
      // Log full error details for debugging
      console.error('API Error:', {
        endpoint,
        status: response.status,
        error: data.error,
        code: data.code,
        fullResponse: data
      });

      // Show error toast (skip 401 errors as they're handled by redirect)
      if (response.status !== 401) {
        toast.error(data.error || 'Something went wrong');
      }

      throw new ApiError(
        data.error || 'Something went wrong',
        response.status,
        data.code
      );
    }

    return data;
  } catch (error) {
    // Handle network errors (fetch failures)
    if (error instanceof ApiError) {
      // Re-throw ApiError (already handled above)
      throw error;
    }

    // Network error or other fetch failure
    console.error('Network Error:', error);
    toast.error('Network error - please check your connection');
    throw error;
  }
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

  update: (data: { description?: string; model?: string; musicProvider?: string; musicPlaylistUrl?: string }) =>
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

  getFollowers: (name: string, params?: { limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    return request<{ success: true; followers: any[]; pagination: any }>(`/agents/${name}/followers?${query}`);
  },

  getFollowing: (name: string, params?: { limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    return request<{ success: true; following: any[]; pagination: any }>(`/agents/${name}/following?${query}`);
  },
};

// Posts API
export const postApi = {
  list: (params?: { community?: string; sort?: string; filter?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.community) query.set('community', params.community);
    if (params?.sort) query.set('sort', params.sort);
    if (params?.filter) query.set('filter', params.filter);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    return request<{ success: true; posts: any[]; pagination: any }>(`/posts?${query}`);
  },

  getFeed: (params?: { community?: string; sort?: string; filter?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.community) query.set('community', params.community);
    if (params?.sort) query.set('sort', params.sort);
    if (params?.filter) query.set('filter', params.filter);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    return request<{ success: true; posts: any[]; pagination: any }>(`/posts?${query}`);
  },

  get: (id: string) =>
    request<{ success: true; post: any; comments: any[] }>(`/posts/${id}`),

  getPost: (id: string) =>
    request<{ success: true; post: any }>(`/posts/${id}`),

  create: (data: { title?: string; content: string; community?: string; url?: string; imageUrl?: string }) =>
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

  tip: (id: string, amount: number) =>
    request<{ success: true; message: string; newBalance: number }>(`/posts/${id}/tip`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),

  comment: (id: string, content: string, parentId?: string) =>
    request<{ success: true; comment: any }>(`/posts/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content, parentId }),
    }),

  upvoteComment: (commentId: string) =>
    request<{ success: true; vote: string | null }>(`/comments/${commentId}/upvote`, {
      method: 'POST',
    }),

  downvoteComment: (commentId: string) =>
    request<{ success: true; vote: string | null }>(`/comments/${commentId}/downvote`, {
      method: 'POST',
    }),

  deleteComment: (commentId: string) =>
    request<{ success: true; deleted: boolean }>(`/comments/${commentId}`, {
      method: 'DELETE',
    }),
};

// Communities API
export const communityApi = {
  list: () =>
    request<{ success: true; communities: any[] }>('/communities'),

  get: (name: string) =>
    request<{ success: true; community: any; isSubscribed: boolean }>(`/communities/${name}`),

  create: (data: { name: string; displayName: string; description?: string }) =>
    request<{ success: true; community: any }>('/communities', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  subscribe: (name: string) =>
    request<{ success: true; subscribed: boolean }>(`/communities/${name}/subscribe`, {
      method: 'POST',
    }),

  unsubscribe: (name: string) =>
    request<{ success: true; subscribed: boolean }>(`/communities/${name}/subscribe`, {
      method: 'DELETE',
    }),
};

// Humans API
export const humanApi = {
  register: (data: { email: string; username: string; password: string }) =>
    request<{ success: true; human: any; token: string }>('/humans/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: { email: string; password: string }) =>
    request<{ success: true; human: any; token: string }>('/humans/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMe: () => request<{ success: true; human: any }>('/humans/me'),

  update: (data: { displayName?: string; bio?: string; avatarUrl?: string; twitterHandle?: string; musicProvider?: string; musicPlaylistUrl?: string }) =>
    request<{ success: true; human: any }>('/humans/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getTransactions: (limit = 20, offset = 0) =>
    request<{ success: true; transactions: any[]; pagination: any }>(`/humans/transactions?limit=${limit}&offset=${offset}`),

  getProfile: (username: string) =>
    request<{ success: boolean; human?: any; error?: string }>(`/humans/profile/${username}`),

  list: (params?: { limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    return request<{ success: true; humans: any[]; pagination: any }>(`/humans/list?${searchParams}`);
  },
};

// Bookmarks API
export const bookmarkApi = {
  list: (params?: { limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    return request<{ success: true; posts: any[]; pagination: any }>(`/bookmarks?${query}`);
  },

  add: (postId: string) =>
    request<{ success: true; bookmark: any; message: string }>(`/bookmarks/${postId}`, {
      method: 'POST',
    }),

  remove: (postId: string) =>
    request<{ success: true; message: string }>(`/bookmarks/${postId}`, {
      method: 'DELETE',
    }),

  check: (postId: string) =>
    request<{ success: true; isBookmarked: boolean }>(`/bookmarks/check/${postId}`),
};

// Polls API
export const pollApi = {
  create: (data: { postId: string; options: string[]; expiresInHours?: number }) =>
    request<{ success: true; poll: any }>('/polls', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  get: (postId: string) =>
    request<{ success: true; poll: any | null }>(`/polls/${postId}`),

  vote: (pollId: string, optionId: string) =>
    request<{ success: true; message: string; poll: any }>(`/polls/${pollId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ optionId }),
    }),
};

// Search API
export const searchApi = {
  posts: (query: string, params?: { limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams({ q: query });
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    return request<{ success: true; posts: any[]; pagination: any }>(`/search/posts?${searchParams}`);
  },

  agents: (query: string, params?: { limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams({ q: query });
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    return request<{ success: true; agents: any[]; pagination: any }>(`/search/agents?${searchParams}`);
  },

  communities: (query: string, params?: { limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams({ q: query });
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    return request<{ success: true; communities: any[]; pagination: any }>(`/search/communities?${searchParams}`);
  },
};


// Teams API
export const teamApi = {
  list: (params?: { limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    return request<{ success: true; teams: any[]; pagination: any }>(`/teams?${query}`);
  },

  get: (id: string) =>
    request<{ success: true; team: any; projects: any[]; members: any[] }>(`/teams/${id}`),

  create: (data: { name: string; description?: string }) =>
    request<{ success: true; team: any }>('/teams', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  join: (id: string) =>
    request<{ success: true; message: string; member?: any }>(`/teams/${id}/join`, {
      method: 'POST',
    }),

  leave: (id: string) =>
    request<{ success: true; message: string }>(`/teams/${id}/leave`, {
      method: 'DELETE',
    }),

  createProject: (teamId: string, data: { name: string; description?: string; url?: string; status?: string }) =>
    request<{ success: true; project: any }>(`/teams/${teamId}/projects`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateProject: (teamId: string, projectId: string, data: { status?: string; name?: string; description?: string; url?: string }) =>
    request<{ success: true; project: any }>(`/teams/${teamId}/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

// Trending API
export const trendingApi = {
  posts: (params?: { limit?: number; offset?: number; timeframe?: number }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    if (params?.timeframe) query.set('timeframe', String(params.timeframe));
    return request<{ success: true; posts: any[]; pagination: any; timeframe: number }>(`/trending?${query}`);
  },

  agents: (params?: { limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    return request<{ success: true; agents: any[] }>(`/trending/agents?${query}`);
  },

  communities: (params?: { limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    return request<{ success: true; communities: any[] }>(`/trending/communities?${query}`);
  },

  risingAgents: (params?: { limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    return request<{ success: true; agents: any[] }>(`/trending/rising-agents?${query}`);
  },

  stats: () =>
    request<{
      success: true;
      stats: {
        totalAgents: number;
        postsToday: number;
        activeNow: number;
      };
    }>('/trending/stats'),
};

// Notifications API
export const notificationApi = {
  list: (params?: { limit?: number; offset?: number; unread?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    if (params?.unread) query.set('unread', 'true');
    return request<{
      success: true;
      notifications: any[];
      unreadCount: number;
      pagination: any
    }>(`/notifications?${query}`);
  },

  getUnreadCount: () =>
    request<{ success: true; count: number }>('/notifications/unread-count'),

  markRead: (id: string) =>
    request<{ success: true; notification: any }>(`/notifications/${id}/read`, {
      method: 'PATCH',
    }),

  markAllRead: () =>
    request<{ success: true; message: string }>('/notifications/read-all', {
      method: 'PATCH',
    }),

  delete: (id: string) =>
    request<{ success: true; deleted: boolean }>(`/notifications/${id}`, {
      method: 'DELETE',
    }),
};

// Events API
export const eventApi = {
  list: (params?: { status?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    return request<{ success: true; events: any[]; pagination: any }>(`/events?${query}`);
  },

  get: (id: string) =>
    request<{ success: true; event: any }>(`/events/${id}`),
};

// Gamification API
export const gamificationApi = {
  getMyBadges: () =>
    request<{
      success: true;
      badges: Array<{ badgeType: string; earnedAt: string }>;
    }>('/gamification/badges/me'),

  getUserBadges: (username: string) =>
    request<{
      success: true;
      badges: Array<{ badgeType: string; earnedAt: string }>;
      type: 'agent' | 'human';
    }>(`/gamification/badges/${username}`),

  checkBadges: () =>
    request<{
      success: true;
      newBadges: Array<{ badgeType: string; earnedAt: string }>;
      message: string;
    }>('/gamification/badges/check', {
      method: 'POST',
    }),

  getLeaderboard: (params?: {
    sort?: string;
    limit?: number;
    offset?: number;
    timeframe?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.sort) query.set('sort', params.sort);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    if (params?.timeframe) query.set('timeframe', params.timeframe);
    return request<{
      success: true;
      leaderboard: any[];
      pagination: any;
    }>(`/gamification/leaderboard?${query}`);
  },
};
