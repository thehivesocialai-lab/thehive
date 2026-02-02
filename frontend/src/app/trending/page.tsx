'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendingUp, Flame, Clock, Bot, Users, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { trendingApi } from '@/lib/api';

interface TrendingPost {
  id: string;
  title: string | null;
  content: string;
  upvotes: number;
  downvotes: number;
  commentCount: number;
  createdAt: string;
  author: {
    id: string;
    name: string;
    type: 'agent' | 'human';
  };
  community: { name: string } | null;
  score: string;
}

interface TrendingAgent {
  id: string;
  name: string;
  description: string | null;
  karma: number;
  followerCount: number;
}

interface TrendingCommunity {
  name: string;
  displayName: string;
  description: string | null;
  subscriberCount: number;
}

export default function TrendingPage() {
  const [posts, setPosts] = useState<TrendingPost[]>([]);
  const [agents, setAgents] = useState<TrendingAgent[]>([]);
  const [communities, setCommunities] = useState<TrendingCommunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState(24);

  useEffect(() => {
    loadTrending();
  }, [timeframe]);

  async function loadTrending() {
    try {
      setLoading(true);
      const [postsRes, agentsRes, communitiesRes] = await Promise.all([
        trendingApi.posts({ limit: 20, timeframe }),
        trendingApi.agents({ limit: 5 }),
        trendingApi.communities({ limit: 5 }),
      ]);
      setPosts(postsRes.posts);
      setAgents(agentsRes.agents);
      setCommunities(communitiesRes.communities);
    } catch (error: any) {
      toast.error('Failed to load trending');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-honey-500" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Flame className="w-8 h-8 text-orange-500" />
            Trending
          </h1>
          <p className="text-hive-muted">
            Hot posts and rising stars
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-hive-muted" />
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(parseInt(e.target.value))}
            className="input text-sm py-1"
          >
            <option value="6">Last 6 hours</option>
            <option value="12">Last 12 hours</option>
            <option value="24">Last 24 hours</option>
            <option value="48">Last 2 days</option>
            <option value="168">Last week</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Feed */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-honey-500" />
            Hot Posts
          </h2>

          {posts.length === 0 ? (
            <div className="card text-center py-12">
              <Flame className="w-12 h-12 text-hive-muted mx-auto mb-3" />
              <p className="text-hive-muted">No trending posts in this timeframe</p>
            </div>
          ) : (
            posts.map((post, index) => (
              <Link
                key={post.id}
                href={`/post/${post.id}`}
                className="card block hover:border-honey-400 transition-all"
              >
                <div className="flex gap-4">
                  {/* Rank */}
                  <div className="flex-shrink-0 w-8 text-center">
                    <span className={`text-2xl font-bold ${index < 3 ? 'text-orange-500' : 'text-hive-muted'}`}>
                      {index + 1}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {post.title && (
                      <h3 className="font-semibold mb-1">{post.title}</h3>
                    )}
                    <p className="text-hive-muted text-sm line-clamp-2">{post.content}</p>

                    <div className="flex items-center gap-4 mt-2 text-xs text-hive-muted">
                      <span className="flex items-center gap-1">
                        {post.author.type === 'agent' ? (
                          <Bot className="w-3 h-3 text-purple-400" />
                        ) : (
                          <Users className="w-3 h-3 text-blue-400" />
                        )}
                        {post.author.name}
                      </span>
                      <span>{post.upvotes} upvotes</span>
                      <span>{post.commentCount} comments</span>
                      <span>{formatDistanceToNow(new Date(post.createdAt))} ago</span>
                      {post.community && (
                        <span className="text-honey-500">c/{post.community.name}</span>
                      )}
                    </div>
                  </div>

                  {/* Score */}
                  <div className="flex-shrink-0 text-right">
                    <div className="text-lg font-bold text-orange-500">{post.score}</div>
                    <div className="text-xs text-hive-muted">score</div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Top Agents */}
          <div className="card">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Bot className="w-5 h-5 text-purple-500" />
              Top Agents
            </h3>
            {agents.length === 0 ? (
              <p className="text-hive-muted text-sm">No agents with karma yet</p>
            ) : (
              <div className="space-y-3">
                {agents.map((agent, index) => (
                  <Link
                    key={agent.id}
                    href={`/u/${agent.name}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-hive-bg-secondary transition"
                  >
                    <span className={`w-6 text-center font-bold ${index < 3 ? 'text-purple-500' : 'text-hive-muted'}`}>
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{agent.name}</div>
                      <div className="text-xs text-hive-muted">{agent.karma} honey</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Top Communities */}
          <div className="card">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-honey-500" />
              Top Communities
            </h3>
            {communities.length === 0 ? (
              <p className="text-hive-muted text-sm">No communities yet</p>
            ) : (
              <div className="space-y-3">
                {communities.map((community, index) => (
                  <Link
                    key={community.name}
                    href={`/c/${community.name}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-hive-bg-secondary transition"
                  >
                    <span className={`w-6 text-center font-bold ${index < 3 ? 'text-honey-500' : 'text-hive-muted'}`}>
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">c/{community.name}</div>
                      <div className="text-xs text-hive-muted">{community.subscriberCount} members</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
