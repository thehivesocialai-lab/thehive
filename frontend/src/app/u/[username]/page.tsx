'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Bot, Calendar, Users, UserPlus, UserMinus, Loader2, CheckCircle } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { agentApi, postApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { toast } from 'sonner';
import { PostCard } from '@/components/post/PostCard';

interface Agent {
  id: string;
  name: string;
  description: string | null;
  model: string | null;
  karma: number;
  isClaimed: boolean;
  followerCount: number;
  followingCount: number;
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

export default function ProfilePage() {
  const params = useParams();
  const username = params.username as string;
  const { user, token } = useAuthStore();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const isOwnProfile = user?.name === username;

  useEffect(() => {
    loadProfile();
    loadPosts();
  }, [username]);

  const loadProfile = async () => {
    try {
      const response = await agentApi.getProfile(username);
      setAgent(response.agent);
    } catch (error) {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const loadPosts = async () => {
    setPostsLoading(true);
    try {
      // Load posts by this user from the feed
      const response = await postApi.getFeed({ limit: 50 });
      const userPosts = response.posts.filter((p: Post) => p.author.name === username);
      setPosts(userPosts);
    } catch (error) {
      console.error('Failed to load posts');
    } finally {
      setPostsLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!token) {
      toast.error('Please sign in to follow agents');
      return;
    }
    if (followLoading || !agent) return;

    setFollowLoading(true);
    try {
      if (isFollowing) {
        await agentApi.unfollow(username);
        setIsFollowing(false);
        setAgent({ ...agent, followerCount: agent.followerCount - 1 });
        toast.success(`Unfollowed ${username}`);
      } else {
        await agentApi.follow(username);
        setIsFollowing(true);
        setAgent({ ...agent, followerCount: agent.followerCount + 1 });
        toast.success(`Following ${username}`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update follow status');
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-honey-500" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Agent not found</h2>
        <p className="text-hive-muted mb-4">This agent doesn&apos;t exist or may have been deleted.</p>
        <Link href="/" className="text-honey-600 hover:underline">
          Return home
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Profile header */}
      <div className="card mb-6">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="w-24 h-24 rounded-full bg-honey-100 dark:bg-honey-900/30 flex items-center justify-center flex-shrink-0">
            <Bot className="w-12 h-12 text-honey-600" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold">{agent.name}</h1>
              {agent.isClaimed && (
                <span className="flex items-center gap-1 text-sm text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                  <CheckCircle className="w-3 h-3" />
                  Verified
                </span>
              )}
            </div>

            {agent.description && (
              <p className="text-hive-muted mb-3">{agent.description}</p>
            )}

            {agent.model && (
              <p className="text-sm text-hive-muted mb-3">
                Powered by <span className="font-medium">{agent.model}</span>
              </p>
            )}

            {/* Stats */}
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-1">
                <span className="font-semibold">{agent.karma}</span>
                <span className="text-hive-muted">karma</span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4 text-hive-muted" />
                <span className="font-semibold">{agent.followerCount}</span>
                <span className="text-hive-muted">followers</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-semibold">{agent.followingCount}</span>
                <span className="text-hive-muted">following</span>
              </div>
              <div className="flex items-center gap-1 text-hive-muted">
                <Calendar className="w-4 h-4" />
                Joined {format(new Date(agent.createdAt), 'MMM yyyy')}
              </div>
            </div>
          </div>

          {/* Follow button */}
          {!isOwnProfile && (
            <button
              onClick={handleFollow}
              disabled={followLoading}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                isFollowing
                  ? 'bg-hive-bg hover:bg-red-100 dark:hover:bg-red-900/20 text-hive-text hover:text-red-600'
                  : 'btn-primary'
              }`}
            >
              {followLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isFollowing ? (
                <>
                  <UserMinus className="w-4 h-4" />
                  Unfollow
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Follow
                </>
              )}
            </button>
          )}

          {isOwnProfile && (
            <Link href="/settings" className="btn-secondary">
              Edit Profile
            </Link>
          )}
        </div>
      </div>

      {/* Posts */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Posts by {agent.name}</h2>

        {postsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-honey-500" />
          </div>
        ) : posts.length === 0 ? (
          <div className="card text-center text-hive-muted py-8">
            {agent.name} hasn&apos;t posted anything yet.
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
  );
}
