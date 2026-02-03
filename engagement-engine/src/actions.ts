import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { Agent } from './agents';

interface Post {
  id: string;
  content: string;
  author: {
    id: string;
    name: string;
  };
  created_at: string;
  upvotes: number;
}

interface ContentData {
  [category: string]: string[];
}

interface CommentsData {
  [category: string]: string[];
}

export class ActionManager {
  private baseUrl: string;
  private postsContent: ContentData;
  private commentsContent: CommentsData;

  constructor() {
    this.baseUrl = process.env.HIVE_API_URL || 'https://api.thehive.social';
    this.postsContent = this.loadContent('posts.json');
    this.commentsContent = this.loadContent('comments.json');
  }

  private loadContent(filename: string): any {
    try {
      const contentPath = path.join(__dirname, 'content', filename);
      const fileContent = fs.readFileSync(contentPath, 'utf-8');
      return JSON.parse(fileContent);
    } catch (error) {
      console.error(`Error loading ${filename}:`, error);
      return {};
    }
  }

  private getRandomItem<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  private getAllPosts(): string[] {
    const allPosts: string[] = [];
    Object.values(this.postsContent).forEach(posts => {
      allPosts.push(...posts);
    });
    return allPosts;
  }

  private getAllComments(): string[] {
    const allComments: string[] = [];
    Object.values(this.commentsContent).forEach(comments => {
      allComments.push(...comments);
    });
    return allComments;
  }

  public async createPost(agent: Agent): Promise<boolean> {
    try {
      const allPosts = this.getAllPosts();
      if (allPosts.length === 0) {
        console.error('No posts available');
        return false;
      }

      const content = this.getRandomItem(allPosts);

      const response = await axios.post(
        `${this.baseUrl}/posts`,
        { content },
        {
          headers: {
            'Authorization': `Bearer ${agent.api_key}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`✓ ${agent.name} created post: "${content.substring(0, 50)}..."`);
      return true;
    } catch (error: any) {
      console.error(`✗ ${agent.name} failed to create post:`, error.response?.data || error.message);
      return false;
    }
  }

  public async commentOnPost(agent: Agent): Promise<boolean> {
    try {
      // Get recent posts
      const posts = await this.getRecentPosts();
      if (posts.length === 0) {
        console.error('No posts available to comment on');
        return false;
      }

      // Pick a random post that's not from this agent
      const otherPosts = posts.filter(p => p.author.id !== agent.id);
      if (otherPosts.length === 0) {
        console.log(`${agent.name} has no posts from others to comment on`);
        return false;
      }

      const targetPost = this.getRandomItem(otherPosts);
      const allComments = this.getAllComments();
      const comment = this.getRandomItem(allComments);

      const response = await axios.post(
        `${this.baseUrl}/posts/${targetPost.id}/comments`,
        { content: comment },
        {
          headers: {
            'Authorization': `Bearer ${agent.api_key}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`✓ ${agent.name} commented on post by ${targetPost.author.name}: "${comment.substring(0, 50)}..."`);
      return true;
    } catch (error: any) {
      console.error(`✗ ${agent.name} failed to comment:`, error.response?.data || error.message);
      return false;
    }
  }

  public async upvotePost(agent: Agent): Promise<boolean> {
    try {
      // Get recent posts
      const posts = await this.getRecentPosts();
      if (posts.length === 0) {
        console.error('No posts available to upvote');
        return false;
      }

      // Pick a random post that's not from this agent
      const otherPosts = posts.filter(p => p.author.id !== agent.id);
      if (otherPosts.length === 0) {
        console.log(`${agent.name} has no posts from others to upvote`);
        return false;
      }

      const targetPost = this.getRandomItem(otherPosts);

      const response = await axios.post(
        `${this.baseUrl}/posts/${targetPost.id}/upvote`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${agent.api_key}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`✓ ${agent.name} upvoted post by ${targetPost.author.name}`);
      return true;
    } catch (error: any) {
      console.error(`✗ ${agent.name} failed to upvote:`, error.response?.data || error.message);
      return false;
    }
  }

  private async getRecentPosts(limit: number = 50): Promise<Post[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/posts`, {
        params: { limit, sort: 'recent' }
      });
      return response.data.posts || [];
    } catch (error: any) {
      console.error('Error fetching recent posts:', error.response?.data || error.message);
      return [];
    }
  }

  public async performRandomAction(agent: Agent): Promise<string> {
    const postProb = parseInt(process.env.POST_PROBABILITY || '40');
    const commentProb = parseInt(process.env.COMMENT_PROBABILITY || '40');
    const upvoteProb = parseInt(process.env.UPVOTE_PROBABILITY || '20');

    const rand = Math.random() * 100;

    if (rand < postProb) {
      const success = await this.createPost(agent);
      return success ? 'post' : 'failed';
    } else if (rand < postProb + commentProb) {
      const success = await this.commentOnPost(agent);
      return success ? 'comment' : 'failed';
    } else {
      const success = await this.upvotePost(agent);
      return success ? 'upvote' : 'failed';
    }
  }
}
