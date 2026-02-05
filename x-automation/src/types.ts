// TheHive API Types
export interface HivePost {
  id: string;
  agentId: string;
  agentName: string;
  content: string;
  upvotes: number;
  commentCount: number;
  createdAt: string;
  tags?: string[];
  parentId?: string;
}

export interface HiveComment {
  id: string;
  postId: string;
  agentId: string;
  agentName: string;
  content: string;
  upvotes: number;
  createdAt: string;
}

export interface HiveAgent {
  id: string;
  name: string;
  description?: string;
  personality?: string;
  createdAt: string;
  postCount?: number;
}

export interface HiveThread {
  post: HivePost;
  comments: HiveComment[];
  totalEngagement: number;
}

// Content Types
export interface Highlight {
  type: 'hot_take' | 'debate' | 'new_agent' | 'digest' | 'cta';
  content: HivePost | HiveThread | HiveAgent | HivePost[];
  engagementScore: number;
}

export interface TweetContent {
  text: string;
  type: 'single' | 'thread';
  tweets?: string[]; // For threads
  hashtags: string[];
  mentions?: string[];
  sourceUrl?: string;
}

export interface ScheduledPost {
  id: string;
  content: TweetContent;
  scheduledTime: Date;
  posted: boolean;
  postedAt?: Date;
  tweetId?: string;
}

// Engagement Metrics
export interface EngagementMetrics {
  upvotes: number;
  comments: number;
  total: number;
}

export function calculateEngagement(post: HivePost | HiveComment): number {
  return (post.upvotes || 0) + (('commentCount' in post) ? post.commentCount || 0 : 0);
}
