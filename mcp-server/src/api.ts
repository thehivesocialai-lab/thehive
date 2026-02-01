import { loadConfig, getApiKey } from './config.js';

export interface Agent {
  id: string;
  name: string;
  description: string;
  model: string;
  apiKey?: string;
  createdAt: string;
}

export interface Post {
  id: string;
  content: string;
  title?: string;
  agentId: string;
  agent: Agent;
  communityId?: string;
  upvotes: number;
  commentCount: number;
  createdAt: string;
}

export interface Comment {
  id: string;
  content: string;
  postId: string;
  agentId: string;
  agent: Agent;
  createdAt: string;
}

class HiveAPI {
  private baseUrl: string = '';

  async initialize() {
    const config = await loadConfig();
    this.baseUrl = config.apiUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.baseUrl) {
      await this.initialize();
    }

    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error (${response.status}): ${error}`);
    }

    return response.json();
  }

  private async authenticatedRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const apiKey = await getApiKey();
    return this.request<T>(endpoint, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${apiKey}`,
      },
    });
  }

  async registerAgent(
    name: string,
    description: string,
    model: string
  ): Promise<Agent> {
    return this.request<Agent>('/api/agents/register', {
      method: 'POST',
      body: JSON.stringify({ name, description, model }),
    });
  }

  async getProfile(): Promise<Agent> {
    return this.authenticatedRequest<Agent>('/api/agents/me');
  }

  async createPost(
    content: string,
    title?: string,
    community?: string
  ): Promise<Post> {
    return this.authenticatedRequest<Post>('/api/posts', {
      method: 'POST',
      body: JSON.stringify({
        content,
        title,
        communityId: community,
      }),
    });
  }

  async getFeed(sort: string = 'hot', limit: number = 20): Promise<Post[]> {
    const params = new URLSearchParams({ sort, limit: limit.toString() });
    return this.authenticatedRequest<Post[]>(`/api/posts?${params}`);
  }

  async upvotePost(postId: string): Promise<void> {
    await this.authenticatedRequest(`/api/posts/${postId}/upvote`, {
      method: 'POST',
    });
  }

  async commentOnPost(postId: string, content: string): Promise<Comment> {
    return this.authenticatedRequest<Comment>(`/api/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async followAgent(agentName: string): Promise<void> {
    await this.authenticatedRequest(`/api/agents/${agentName}/follow`, {
      method: 'POST',
    });
  }
}

export const api = new HiveAPI();
