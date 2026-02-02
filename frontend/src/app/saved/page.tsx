'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bookmark, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth';
import { bookmarkApi } from '@/lib/api';
import { PostCard } from '@/components/post/PostCard';

export default function SavedPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    loadSavedPosts();
  }, [isAuthenticated]);

  async function loadSavedPosts() {
    try {
      setLoading(true);
      const response = await bookmarkApi.list({ limit, offset: 0 });
      setPosts(response.posts);
      setHasMore(response.pagination.hasMore);
      setOffset(limit);
    } catch (error: any) {
      toast.error('Failed to load saved posts');
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    try {
      const response = await bookmarkApi.list({ limit, offset });
      setPosts([...posts, ...response.posts]);
      setHasMore(response.pagination.hasMore);
      setOffset(offset + limit);
    } catch (error: any) {
      toast.error('Failed to load more posts');
    }
  }

  async function handleRemoveBookmark(postId: string) {
    try {
      await bookmarkApi.remove(postId);
      setPosts(posts.filter(p => p.id !== postId));
      toast.success('Removed from saved');
    } catch (error: any) {
      toast.error('Failed to remove bookmark');
    }
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-hive-muted hover:text-hive-text mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to feed
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <Bookmark className="w-8 h-8 text-honey-500" />
        <div>
          <h1 className="text-2xl font-bold">Saved Posts</h1>
          <p className="text-hive-muted">Posts you've bookmarked for later</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-honey-500" />
        </div>
      ) : posts.length === 0 ? (
        <div className="card text-center py-12">
          <Bookmark className="w-12 h-12 mx-auto text-hive-muted mb-4" />
          <h3 className="font-medium text-lg mb-2">No saved posts yet</h3>
          <p className="text-hive-muted mb-4">
            Click the bookmark icon on posts to save them for later.
          </p>
          <Link href="/" className="btn-primary">
            Browse Posts
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div key={post.id} className="relative">
              <PostCard post={post} />
              <button
                onClick={() => handleRemoveBookmark(post.id)}
                className="absolute top-4 right-4 p-2 text-honey-500 hover:bg-honey-100 dark:hover:bg-honey-900/20 rounded-lg transition-colors"
                title="Remove from saved"
              >
                <Bookmark className="w-5 h-5 fill-current" />
              </button>
            </div>
          ))}

          {hasMore && (
            <button
              onClick={loadMore}
              className="w-full py-3 text-center text-honey-500 hover:text-honey-600 font-medium"
            >
              Load more
            </button>
          )}
        </div>
      )}
    </div>
  );
}
