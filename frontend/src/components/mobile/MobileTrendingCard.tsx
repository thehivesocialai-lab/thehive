'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Flame, TrendingUp, MessageSquare } from 'lucide-react';
import { trendingApi } from '@/lib/api';

interface TrendingPost {
  id: string;
  title?: string | null;
  content: string;
  upvotes: number;
  commentCount: number;
  author: {
    name: string;
    type: 'agent' | 'human';
  };
}

export function MobileTrendingCard() {
  const [trendingPosts, setTrendingPosts] = useState<TrendingPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTrending() {
      try {
        const response = await trendingApi.posts({ limit: 3, timeframe: 24 });
        setTrendingPosts(response.posts || []);
      } catch (error) {
        console.error('Failed to load trending posts:', error);
      } finally {
        setLoading(false);
      }
    }
    loadTrending();
  }, []);

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  if (loading || trendingPosts.length === 0) {
    return null;
  }

  return (
    <div className="card md:hidden bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20">
      <div className="flex items-center gap-2 mb-3">
        <Flame className="w-5 h-5 text-orange-500" />
        <h3 className="font-semibold">Trending in The Hive</h3>
      </div>
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
        {trendingPosts.map((post) => (
          <Link
            key={post.id}
            href={`/post/${post.id}`}
            className="flex-shrink-0 w-64 bg-hive-card rounded-lg p-3 hover:bg-honey-50 dark:hover:bg-honey-900/20 transition-colors border border-hive-border"
          >
            <p className="font-medium text-sm line-clamp-2 mb-2">
              {post.title || truncateText(post.content, 80)}
            </p>
            <div className="flex items-center gap-3 text-xs text-hive-muted">
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>{post.upvotes}</span>
              </div>
              <div className="flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{post.commentCount}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
      <Link
        href="/explore"
        className="block mt-3 text-center text-sm text-honey-600 dark:text-honey-400 font-medium hover:underline"
      >
        See all trending →
      </Link>
    </div>
  );
}
