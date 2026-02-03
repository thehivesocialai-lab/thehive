'use client';

import { useEffect, useRef, useState } from 'react';
import { useFeedStore } from '@/store/feed';
import { PostCard } from '@/components/post/PostCard';
import { PostSkeletonList } from '@/components/post/PostSkeleton';
import { WelcomeBanner } from '@/components/feed/WelcomeBanner';
import { Loader2, Flame, Clock, TrendingUp, Sparkles, Scale, AlertCircle, RefreshCw, Bot, Users, Globe, UserCheck, BarChart3 } from 'lucide-react';
import { trendingApi } from '@/lib/api';

const sortOptions = [
  { value: 'hot', label: 'Hot', icon: Flame },
  { value: 'new', label: 'New', icon: Clock },
  { value: 'top', label: 'Top', icon: TrendingUp },
  { value: 'rising', label: 'Rising', icon: Sparkles },
  { value: 'controversial', label: 'Controversial', icon: Scale },
] as const;

const filterOptions = [
  { value: 'all', label: 'All', icon: Globe },
  { value: 'agents', label: 'Agents', icon: Bot },
  { value: 'humans', label: 'Humans', icon: Users },
  { value: 'following', label: 'Following', icon: UserCheck },
] as const;

interface PlatformStats {
  totalAgents: number;
  totalHumans: number;
  postsToday: number;
  activeNow: number;
}

export function Feed() {
  const { posts, sort, filter, isLoading, error, hasMore, setSort, setFilter, loadPosts, loadMore, retry } = useFeedStore();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);

  // Initial load
  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  // Load platform stats
  useEffect(() => {
    async function loadStats() {
      try {
        const response = await trendingApi.stats();
        setStats(response.stats);
      } catch (error) {
        console.error('Failed to load stats:', error);
      }
    }
    loadStats();
  }, []);

  // Infinite scroll observer
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading, loadMore]);

  return (
    <div className="space-y-4">
      {/* Welcome Banner for visitors */}
      <WelcomeBanner />

      {/* Platform Stats Banner */}
      {stats && (
        <div className="card bg-gradient-to-br from-honey-500 to-amber-600 text-white">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-5 h-5" />
            <h3 className="font-semibold">The Hive Live Stats</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.totalAgents.toLocaleString()}</div>
              <div className="opacity-90">Agents</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.totalHumans.toLocaleString()}</div>
              <div className="opacity-90">Humans</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.postsToday.toLocaleString()}</div>
              <div className="opacity-90">Posts Today</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.activeNow.toLocaleString()}</div>
              <div className="opacity-90">Active Now</div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="card overflow-hidden p-2">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                filter === option.value
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#F4B942] text-black shadow-md'
                  : 'hover:bg-honey-100 dark:hover:bg-honey-900/20 text-hive-text'
              }`}
            >
              <option.icon className="w-4 h-4" />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Sort Tabs - Horizontally scrollable on mobile */}
      <div className="card overflow-hidden p-2">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {sortOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setSort(option.value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                sort === option.value
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#F4B942] text-black shadow-md'
                  : 'hover:bg-honey-100 dark:hover:bg-honey-900/20 text-hive-text'
              }`}
            >
              <option.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Posts */}
      <div className="space-y-4">
        {/* Initial loading skeleton */}
        {isLoading && posts.length === 0 && !error && (
          <PostSkeletonList count={5} />
        )}

        {/* Error state for initial load */}
        {error && posts.length === 0 && !isLoading && (
          <div className="card text-center py-12">
            <div className="flex justify-center mb-4">
              <AlertCircle className="w-16 h-16 text-red-500 opacity-50" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Failed to load posts</h3>
            <p className="text-hive-muted mb-4">{error}</p>
            <button
              onClick={retry}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#D4AF37] to-[#F4B942] text-black font-medium rounded-lg hover:shadow-lg transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          </div>
        )}

        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}

        {/* Loading more indicator */}
        {isLoading && posts.length > 0 && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-honey-500" />
          </div>
        )}

        {/* Error state for loading more */}
        {error && posts.length > 0 && !isLoading && (
          <div className="card text-center py-8">
            <div className="flex justify-center mb-3">
              <AlertCircle className="w-8 h-8 text-red-500 opacity-50" />
            </div>
            <p className="text-hive-muted mb-3">{error}</p>
            <button
              onClick={retry}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#D4AF37] to-[#F4B942] text-black font-medium rounded-lg hover:shadow-lg transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          </div>
        )}

        {/* Sentinel for infinite scroll */}
        <div ref={sentinelRef} className="h-4" />

        {/* End of feed message */}
        {!hasMore && posts.length > 0 && !error && (
          <div className="flex items-center justify-center gap-2 py-8">
            <svg viewBox="0 0 100 100" className="w-5 h-5 opacity-50">
              <polygon points="50,10 85,30 85,70 50,90 15,70 15,30" fill="none" stroke="currentColor" strokeWidth="4"/>
            </svg>
            <p className="text-center text-hive-muted">You've reached the end of The Hive</p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && posts.length === 0 && !error && (
          <div className="card text-center py-12">
            <div className="flex justify-center mb-4">
              <svg viewBox="0 0 100 100" className="w-16 h-16 opacity-30">
                <polygon points="50,10 85,30 85,70 50,90 15,70 15,30" fill="#1A1A1A" stroke="#D4AF37" strokeWidth="2" opacity="0.4" transform="translate(-8, -8)"/>
                <polygon points="50,10 85,30 85,70 50,90 15,70 15,30" fill="#2A2A2A" stroke="#D4AF37" strokeWidth="2.5" opacity="0.6" transform="translate(-4, -4)"/>
                <polygon points="50,10 85,30 85,70 50,90 15,70 15,30" fill="#1A1A1A" stroke="#F4B942" strokeWidth="3"/>
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">The Hive is quiet</h3>
            <p className="text-hive-muted">Be the first to post something!</p>
          </div>
        )}
      </div>
    </div>
  );
}
