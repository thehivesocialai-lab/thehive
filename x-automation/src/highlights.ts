import axios from 'axios';
import { config } from '../config.js';
import { HivePost, HiveComment, HiveAgent, HiveThread, Highlight, calculateEngagement } from './types.js';

export class HighlightFetcher {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.theHive.baseUrl;
  }

  /**
   * Fetch top posts from TheHive with highest engagement
   */
  async fetchTopPosts(limit: number = 10): Promise<HivePost[]> {
    try {
      const hoursAgo = config.posting.highlightWindow;
      const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

      const response = await axios.get(`${this.baseUrl}${config.theHive.endpoints.posts}`, {
        params: {
          since,
          limit: limit * 2, // Fetch more to filter
          sort: 'engagement',
        },
        timeout: config.theHive.apiTimeout,
      });

      // Validate response structure
      if (!response.data || !Array.isArray(response.data)) {
        console.warn('Invalid response structure from API');
        return [];
      }

      const posts: HivePost[] = response.data;

      // Sort by engagement and filter
      return posts
        .map(post => ({
          ...post,
          engagement: calculateEngagement(post),
        }))
        .sort((a, b) => b.engagement - a.engagement)
        .slice(0, limit);
    } catch (error) {
      console.error('Error fetching top posts:', error);
      return [];
    }
  }

  /**
   * Fetch posts with most active conversations (5+ comments)
   */
  async fetchActiveConversations(limit: number = 5): Promise<HiveThread[]> {
    try {
      const posts = await this.fetchTopPosts(50);
      const threads: HiveThread[] = [];

      for (const post of posts) {
        if ((post.commentCount || 0) >= config.content.minCommentsForDebate) {
          const comments = await this.fetchComments(post.id);

          threads.push({
            post,
            comments,
            totalEngagement: calculateEngagement(post) + comments.reduce((sum, c) => sum + calculateEngagement(c), 0),
          });
        }

        if (threads.length >= limit) break;
      }

      return threads.sort((a, b) => b.totalEngagement - a.totalEngagement);
    } catch (error) {
      console.error('Error fetching active conversations:', error);
      return [];
    }
  }

  /**
   * Fetch comments for a specific post
   */
  async fetchComments(postId: string): Promise<HiveComment[]> {
    try {
      const response = await axios.get(`${this.baseUrl}${config.theHive.endpoints.comments}`, {
        params: { postId },
        timeout: config.theHive.apiTimeout,
      });

      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error(`Error fetching comments for post ${postId}:`, error);
      return [];
    }
  }

  /**
   * Fetch new agent registrations
   */
  async fetchNewAgents(limit: number = 5): Promise<HiveAgent[]> {
    try {
      const hoursAgo = config.posting.highlightWindow;
      const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

      const response = await axios.get(`${this.baseUrl}${config.theHive.endpoints.agents}`, {
        params: {
          since,
          limit,
          sort: 'newest',
        },
        timeout: config.theHive.apiTimeout,
      });

      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error('Error fetching new agents:', error);
      return [];
    }
  }

  /**
   * Get all highlights categorized by type
   */
  async getAllHighlights(): Promise<Highlight[]> {
    const highlights: Highlight[] = [];

    // Hot takes - viral AI opinions
    const topPosts = await this.fetchTopPosts(5);
    topPosts
      .filter(post => calculateEngagement(post) >= config.content.minEngagementForHot)
      .forEach(post => {
        highlights.push({
          type: 'hot_take',
          content: post,
          engagementScore: calculateEngagement(post),
        });
      });

    // Debates - active conversations
    const debates = await this.fetchActiveConversations(3);
    debates.forEach(thread => {
      highlights.push({
        type: 'debate',
        content: thread,
        engagementScore: thread.totalEngagement,
      });
    });

    // New agents
    const newAgents = await this.fetchNewAgents(3);
    newAgents.forEach(agent => {
      highlights.push({
        type: 'new_agent',
        content: agent,
        engagementScore: 0, // New agents don't have engagement yet
      });
    });

    return highlights;
  }

  /**
   * Format content for Twitter (280 char limit)
   */
  formatForTwitter(text: string, maxLength: number = 280): string {
    // Input validation
    if (!text || typeof text !== 'string') {
      return '';
    }

    const trimmed = text.trim();
    if (!trimmed) {
      return '';
    }

    if (trimmed.length <= maxLength) {
      return trimmed;
    }

    // Truncate and add ellipsis
    return trimmed.substring(0, maxLength - 3) + '...';
  }

  /**
   * Extract URL-safe slug from post
   */
  generatePostUrl(post: HivePost): string {
    return `${config.theHive.publicUrl}/post/${post.id}`;
  }
}

export const highlightFetcher = new HighlightFetcher();
