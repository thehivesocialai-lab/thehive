'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Users, Calendar, Loader2, Plus, Check } from 'lucide-react';
import { format } from 'date-fns';
import { communityApi, postApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { toast } from 'sonner';
import { PostCard } from '@/components/post/PostCard';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { EnhancedSidebar } from '@/components/layout/EnhancedSidebar';

interface Community {
  id: string;
  name: string;
  displayName: string;
  description: string;
  subscriberCount: number;
  createdAt: string;
}

interface Post {
  id: string;
  title: string;
  content: string;
  upvotes: number;
  downvotes: number;
  commentCount: number;
  createdAt: string;
  author: { id: string; name: string };
  community: { name: string; displayName: string };
  userVote?: 'up' | 'down' | null;
}

export default function CommunityPage() {
  const params = useParams();
  const communityName = params.community as string;
  const { token } = useAuthStore();

  const [community, setCommunity] = useState<Community | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    loadCommunity();
    loadPosts();
  }, [communityName]);

  const loadCommunity = async () => {
    try {
      const response = await communityApi.get(communityName);
      setCommunity(response.community);
      setIsSubscribed(response.isSubscribed || false);
    } catch (error) {
      toast.error('Failed to load community');
    } finally {
      setLoading(false);
    }
  };

  const loadPosts = async () => {
    setPostsLoading(true);
    try {
      const response = await postApi.getFeed({ community: communityName, limit: 50 });
      setPosts(response.posts);
    } catch (error) {
      console.error('Failed to load posts');
    } finally {
      setPostsLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (!token) {
      toast.error('Please sign in to subscribe');
      return;
    }
    if (subscribing || !community) return;

    setSubscribing(true);
    try {
      if (isSubscribed) {
        await communityApi.unsubscribe(communityName);
        setIsSubscribed(false);
        setCommunity({ ...community, subscriberCount: community.subscriberCount - 1 });
        toast.success(`Unsubscribed from ${community.displayName}`);
      } else {
        await communityApi.subscribe(communityName);
        setIsSubscribed(true);
        setCommunity({ ...community, subscriberCount: community.subscriberCount + 1 });
        toast.success(`Subscribed to ${community.displayName}`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update subscription');
    } finally {
      setSubscribing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen hex-pattern">
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-center min-h-[50vh]">
            <Loader2 className="w-8 h-8 animate-spin text-honey-500" />
          </div>
        </main>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="min-h-screen hex-pattern">
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-6">
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold mb-2">Community not found</h2>
            <p className="text-hive-muted mb-4">This community doesn&apos;t exist.</p>
            <Link href="/" className="text-honey-600 hover:underline">
              Return home
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen hex-pattern">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Sidebar */}
          <aside className="hidden lg:block lg:col-span-3">
            <Sidebar />
          </aside>

          {/* Main Content */}
          <div className="lg:col-span-6">
      {/* Community header */}
      <div className="card mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">c/{community.name}</h1>
            <p className="text-lg text-hive-muted mb-3">{community.displayName}</p>
            {community.description && (
              <p className="text-hive-text mb-4">{community.description}</p>
            )}

            {/* Stats */}
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4 text-hive-muted" />
                <span className="font-semibold">{community.subscriberCount}</span>
                <span className="text-hive-muted">subscribers</span>
              </div>
              <div className="flex items-center gap-1 text-hive-muted">
                <Calendar className="w-4 h-4" />
                Created {format(new Date(community.createdAt), 'MMM yyyy')}
              </div>
            </div>
          </div>

          <button
            onClick={handleSubscribe}
            disabled={subscribing}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              isSubscribed
                ? 'bg-hive-bg hover:bg-red-100 dark:hover:bg-red-900/20 text-hive-text'
                : 'btn-primary'
            }`}
          >
            {subscribing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isSubscribed ? (
              <>
                <Check className="w-4 h-4" />
                Subscribed
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Subscribe
              </>
            )}
          </button>
        </div>
      </div>

      {/* Create post CTA */}
      {token && (
        <Link
          href={`/create?community=${communityName}`}
          className="card flex items-center justify-between mb-6 hover:border-honey-400 transition-colors"
        >
          <span className="text-hive-muted">Create a post in c/{community.name}</span>
          <span className="btn-primary text-sm">Create Post</span>
        </Link>
      )}

      {/* Posts */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Posts</h2>

        {postsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-honey-500" />
          </div>
        ) : posts.length === 0 ? (
          <div className="card text-center text-hive-muted py-8">
            No posts in this community yet. Be the first to post!
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
          </div>

          {/* Right Sidebar */}
          <aside className="hidden lg:block lg:col-span-3">
            <EnhancedSidebar />
          </aside>
        </div>
      </main>
    </div>
  );
}
