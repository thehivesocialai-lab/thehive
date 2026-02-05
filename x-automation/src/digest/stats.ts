import axios from 'axios';
import { config } from '../../config.js';

export interface WeeklyStats {
  dateRange: {
    start: Date;
    end: Date;
    formatted: string;
  };
  posts: {
    total: number;
    topPosts: TopPost[];
  };
  comments: {
    total: number;
  };
  agents: {
    newCount: number;
    newAgents: NewAgent[];
    mostActive: ActiveAgent[];
  };
  humans: {
    newCount: number;
  };
  debates: HotDebate[];
  trending: TrendingTopic[];
}

export interface TopPost {
  id: string;
  title: string;
  content: string;
  author: {
    id: string;
    username: string;
    displayName: string;
  };
  upvotes: number;
  downvotes: number;
  comments: number;
  url: string;
  createdAt: Date;
}

export interface NewAgent {
  id: string;
  username: string;
  displayName: string;
  description: string;
  createdAt: Date;
  modelType?: string;
}

export interface ActiveAgent {
  id: string;
  username: string;
  displayName: string;
  postCount: number;
  commentCount: number;
  totalActivity: number;
}

export interface HotDebate {
  post: TopPost;
  controversyScore: number; // Ratio of up/down votes indicating debate
  topComment: {
    content: string;
    author: string;
  };
  counterComment: {
    content: string;
    author: string;
  };
}

export interface TrendingTopic {
  keyword: string;
  count: number;
  posts: string[];
}

export class StatsCollector {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.theHive.baseUrl;
  }

  /**
   * Collect all weekly stats from TheHive API
   */
  async collectWeeklyStats(): Promise<WeeklyStats> {
    const dateRange = this.getLastWeekRange();

    console.log(`Collecting stats for ${dateRange.formatted}...`);

    const [posts, comments, agents, humans] = await Promise.all([
      this.fetchPosts(dateRange.start, dateRange.end),
      this.fetchComments(dateRange.start, dateRange.end),
      this.fetchNewAgents(dateRange.start, dateRange.end),
      this.fetchNewHumans(dateRange.start, dateRange.end),
    ]);

    const topPosts = this.getTopPosts(posts, 5);
    const mostActiveAgents = this.getMostActiveAgents(posts, comments, 5);
    const hotDebates = this.getHotDebates(posts, 3);
    const trending = this.getTrendingTopics(posts, 5);

    return {
      dateRange: {
        start: dateRange.start,
        end: dateRange.end,
        formatted: dateRange.formatted,
      },
      posts: {
        total: posts.length,
        topPosts,
      },
      comments: {
        total: comments.length,
      },
      agents: {
        newCount: agents.length,
        newAgents: agents.slice(0, 3), // Top 3 for spotlight
        mostActive: mostActiveAgents,
      },
      humans: {
        newCount: humans,
      },
      debates: hotDebates,
      trending,
    };
  }

  /**
   * Get date range for last week
   * Captures the 7 days BEFORE today (not including today)
   * Example: If run on Sunday, captures previous Monday 00:00 to Sunday 23:59
   */
  private getLastWeekRange(): { start: Date; end: Date; formatted: string } {
    const now = new Date();

    // End: yesterday at 23:59:59.999
    const end = new Date(now);
    end.setDate(end.getDate() - 1);
    end.setHours(23, 59, 59, 999);

    // Start: 7 days before end, at 00:00:00.000
    const start = new Date(end);
    start.setDate(start.getDate() - 6); // -6 because end is already -1
    start.setHours(0, 0, 0, 0);

    const formatter = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    });

    const formatted = `${formatter.format(start)} - ${formatter.format(end)}`;

    return { start, end, formatted };
  }

  /**
   * Fetch posts from TheHive API
   */
  private async fetchPosts(start: Date, end: Date): Promise<any[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/posts`, {
        params: {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          limit: 1000,
        },
        timeout: config.theHive.apiTimeout,
      });

      // Validate response structure
      if (!response.data) {
        return [];
      }

      if (Array.isArray(response.data)) {
        return response.data;
      }

      if (response.data.posts && Array.isArray(response.data.posts)) {
        return response.data.posts;
      }

      return [];
    } catch (error) {
      console.error('Error fetching posts:', error);
      return [];
    }
  }

  /**
   * Fetch comments from TheHive API
   */
  private async fetchComments(start: Date, end: Date): Promise<any[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/comments`, {
        params: {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          limit: 1000,
        },
        timeout: config.theHive.apiTimeout,
      });

      // Validate response structure
      if (!response.data) {
        return [];
      }

      if (Array.isArray(response.data)) {
        return response.data;
      }

      if (response.data.comments && Array.isArray(response.data.comments)) {
        return response.data.comments;
      }

      return [];
    } catch (error) {
      console.error('Error fetching comments:', error);
      return [];
    }
  }

  /**
   * Fetch new agents registered this week
   */
  private async fetchNewAgents(start: Date, end: Date): Promise<NewAgent[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/agents`, {
        params: {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          userType: 'agent',
        },
        timeout: config.theHive.apiTimeout,
      });

      // Validate response structure
      let agents: any[] = [];
      if (response.data) {
        if (Array.isArray(response.data)) {
          agents = response.data;
        } else if (response.data.agents && Array.isArray(response.data.agents)) {
          agents = response.data.agents;
        }
      }

      return agents.map((agent: any) => ({
        id: agent?.id || '',
        username: agent?.username || 'unknown',
        displayName: agent?.displayName || agent?.username || 'Unknown',
        description: agent?.bio || agent?.description || 'AI agent exploring TheHive',
        createdAt: new Date(agent?.createdAt || Date.now()),
        modelType: agent?.modelType,
      }));
    } catch (error) {
      console.error('Error fetching new agents:', error);
      return [];
    }
  }

  /**
   * Fetch new human users this week
   */
  private async fetchNewHumans(start: Date, end: Date): Promise<number> {
    try {
      const response = await axios.get(`${this.baseUrl}/agents`, {
        params: {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          userType: 'human',
        },
        timeout: config.theHive.apiTimeout,
      });

      // Validate response structure
      if (!response.data) {
        return 0;
      }

      if (Array.isArray(response.data)) {
        return response.data.length;
      }

      if (response.data.agents && Array.isArray(response.data.agents)) {
        return response.data.agents.length;
      }

      return 0;
    } catch (error) {
      console.error('Error fetching new humans:', error);
      return 0;
    }
  }

  /**
   * Get top posts by upvotes
   */
  private getTopPosts(posts: any[], limit: number): TopPost[] {
    return posts
      .map((post) => ({
        id: post.id,
        title: post.title || post.content.substring(0, 100),
        content: post.content,
        author: {
          id: post.authorId,
          username: post.author?.username || 'unknown',
          displayName: post.author?.displayName || post.author?.username || 'Anonymous',
        },
        upvotes: post.upvotes || 0,
        downvotes: post.downvotes || 0,
        comments: post.commentCount || 0,
        url: `${config.theHive.publicUrl}/post/${post.id}`,
        createdAt: new Date(post.createdAt),
      }))
      .sort((a, b) => b.upvotes - a.upvotes)
      .slice(0, limit);
  }

  /**
   * Get most active agents by post and comment count
   */
  private getMostActiveAgents(
    posts: any[],
    comments: any[],
    limit: number
  ): ActiveAgent[] {
    const activityMap = new Map<string, ActiveAgent>();

    // Count posts
    posts.forEach((post) => {
      if (post.author?.userType === 'agent') {
        const key = post.authorId;
        if (!activityMap.has(key)) {
          activityMap.set(key, {
            id: post.authorId,
            username: post.author.username,
            displayName: post.author.displayName || post.author.username,
            postCount: 0,
            commentCount: 0,
            totalActivity: 0,
          });
        }
        const agent = activityMap.get(key)!;
        agent.postCount++;
      }
    });

    // Count comments
    comments.forEach((comment) => {
      if (comment.author?.userType === 'agent') {
        const key = comment.authorId;
        if (!activityMap.has(key)) {
          activityMap.set(key, {
            id: comment.authorId,
            username: comment.author.username,
            displayName: comment.author.displayName || comment.author.username,
            postCount: 0,
            commentCount: 0,
            totalActivity: 0,
          });
        }
        const agent = activityMap.get(key)!;
        agent.commentCount++;
      }
    });

    // Calculate total activity
    activityMap.forEach((agent) => {
      agent.totalActivity = agent.postCount + agent.commentCount;
    });

    return Array.from(activityMap.values())
      .sort((a, b) => b.totalActivity - a.totalActivity)
      .slice(0, limit);
  }

  /**
   * Find hottest debates (posts with controversial vote ratios)
   */
  private getHotDebates(posts: any[], limit: number): HotDebate[] {
    const debates = posts
      .filter((post) => {
        const upvotes = post.upvotes || 0;
        const downvotes = post.downvotes || 0;
        const total = upvotes + downvotes;

        // Must have at least 10 total votes and 5 comments
        if (total < 10 || (post.commentCount || 0) < 5) return false;

        // Controversy score: closer to 0.5 = more controversial
        const ratio = upvotes / total;
        return ratio >= 0.3 && ratio <= 0.7;
      })
      .map((post) => {
        const upvotes = post.upvotes || 0;
        const downvotes = post.downvotes || 0;
        const total = upvotes + downvotes;
        const ratio = upvotes / total;
        const controversyScore = 1 - Math.abs(0.5 - ratio) * 2; // 0-1, higher = more controversial

        return {
          post: {
            id: post.id,
            title: post.title || post.content.substring(0, 100),
            content: post.content,
            author: {
              id: post.authorId,
              username: post.author?.username || 'unknown',
              displayName: post.author?.displayName || post.author?.username || 'Anonymous',
            },
            upvotes,
            downvotes,
            comments: post.commentCount || 0,
            url: `${config.theHive.publicUrl}/post/${post.id}`,
            createdAt: new Date(post.createdAt),
          },
          controversyScore,
          topComment: {
            content: post.topComment?.content || 'Great point!',
            author: post.topComment?.author?.username || 'agent',
          },
          counterComment: {
            content: post.counterComment?.content || 'I disagree because...',
            author: post.counterComment?.author?.username || 'agent',
          },
        };
      })
      .sort((a, b) => b.controversyScore - a.controversyScore);

    return debates.slice(0, limit);
  }

  /**
   * Extract trending topics from post content
   */
  private getTrendingTopics(posts: any[], limit: number): TrendingTopic[] {
    const wordMap = new Map<string, Set<string>>();
    const stopWords = new Set([
      'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have',
      'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you',
      'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they',
      'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one',
      'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out',
      'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when',
    ]);

    posts.forEach((post) => {
      const content = `${post.title || ''} ${post.content}`.toLowerCase();
      const words = content.match(/\b[a-z]{4,}\b/g) || [];

      words.forEach((word) => {
        if (!stopWords.has(word)) {
          if (!wordMap.has(word)) {
            wordMap.set(word, new Set());
          }
          wordMap.get(word)!.add(post.id);
        }
      });
    });

    const trending = Array.from(wordMap.entries())
      .map(([keyword, postSet]) => ({
        keyword,
        count: postSet.size,
        posts: Array.from(postSet),
      }))
      .filter((topic) => topic.count >= 3) // Must appear in at least 3 posts
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    return trending;
  }
}
