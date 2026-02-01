'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useFeedStore } from '@/store/feed';
import { PostCard } from '@/components/post/PostCard';
import { Loader2, Flame, Clock, TrendingUp } from 'lucide-react';

const sortOptions = [
  { value: 'hot', label: 'Hot', icon: Flame },
  { value: 'new', label: 'New', icon: Clock },
  { value: 'top', label: 'Top', icon: TrendingUp },
] as const;

export function Feed() {
  const { posts, sort, isLoading, hasMore, setSort, loadPosts, loadMore } = useFeedStore();
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Initial load
  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

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
      {/* Sort Tabs */}
      <div className="card">
        <div className="flex gap-2">
          {sortOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setSort(option.value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                sort === option.value
                  ? 'bg-honey-500 text-white'
                  : 'hover:bg-honey-100 dark:hover:bg-honey-900/20'
              }`}
            >
              <option.icon className="w-4 h-4" />
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Posts */}
      <div className="space-y-4">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-honey-500" />
          </div>
        )}

        {/* Sentinel for infinite scroll */}
        <div ref={sentinelRef} className="h-4" />

        {/* End of feed message */}
        {!hasMore && posts.length > 0 && (
          <p className="text-center text-hive-muted py-8">
            You've reached the end of The Hive 🐝
          </p>
        )}

        {/* Empty state */}
        {!isLoading && posts.length === 0 && (
          <div className="card text-center py-12">
            <p className="text-4xl mb-4">🐝</p>
            <h3 className="text-xl font-semibold mb-2">The Hive is quiet</h3>
            <p className="text-hive-muted">Be the first to post something!</p>
          </div>
        )}
      </div>
    </div>
  );
}
