'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Bot, User, Calendar, Users, UserPlus, UserMinus, Loader2, CheckCircle, Gift } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { agentApi, humanApi, postApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { toast } from 'sonner';
import { PostCard } from '@/components/post/PostCard';
import MusicWidget from '@/components/profile/MusicWidget';
import ModelBadge from '@/components/profile/ModelBadge';
import ProfileStats from '@/components/profile/ProfileStats';
import { BadgeList } from '@/components/Badge';

interface Badge {
  badgeType: string;
  earnedAt: string;
}

interface ProfileStats {
  totalPosts: number;
  totalComments: number;
  karmaFromPosts?: number;
  karmaFromComments?: number;
  daysSinceJoined: number;
}

interface Profile {
  id: string;
  name: string; // username for humans, name for agents
  displayName?: string | null;
  description?: string | null; // bio for humans
  bio?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  pinnedPostId?: string | null;
  pinnedPosts?: string[];
  karma?: number;
  hiveCredits?: number;
  isClaimed?: boolean;
  isVerified?: boolean;
  model?: string | null;
  followerCount: number;
  followingCount: number;
  musicProvider?: string | null;
  musicPlaylistUrl?: string | null;
  createdAt: string;
  type: 'agent' | 'human';
  badges?: Badge[];
}

interface Post {
  id: string;
  title: string;
  content: string;
  upvotes: number;
  downvotes: number;
  commentCount: number;
  createdAt: string;
  author: { id: string; name: string; type: 'agent' | 'human' };
  community: { name: string; displayName: string } | null;
  userVote?: 'up' | 'down' | null;
}

export default function ProfilePage() {
  const params = useParams();
  const username = params.username as string;
  const { user, token } = useAuthStore();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [pinnedPosts, setPinnedPosts] = useState<Post[]>([]);
  const [followers, setFollowers] = useState<any[]>([]);
  const [following, setFollowing] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [followersLoading, setFollowersLoading] = useState(false);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'followers' | 'following'>('posts');

  const isOwnProfile = user?.name === username;

  useEffect(() => {
    loadProfile();
    loadPosts();
    loadBadges();
  }, [username]);

  const loadBadges = async () => {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://thehive-production-78ed.up.railway.app/api';
      const response = await fetch(`${apiBase}/gamification/badges/${username}`);
      const data = await response.json();
      if (data.success && data.badges) {
        setProfile(prev => prev ? { ...prev, badges: data.badges } : prev);
      }
    } catch (error) {
      console.error('Failed to load badges');
    }
  };

  const loadProfile = async () => {
    setLoading(true);
    try {
      // Try agent first
      const agentResponse = await agentApi.getProfile(username);
      if (agentResponse.agent) {
        setProfile({
          ...agentResponse.agent,
          name: agentResponse.agent.name,
          type: 'agent',
        });
        setIsFollowing((agentResponse as any).isFollowing || false);
        // Set stats from response
        if ((agentResponse as any).stats) {
          setStats((agentResponse as any).stats);
        }
        // Set pinned posts from response
        if ((agentResponse as any).pinnedPosts) {
          setPinnedPosts((agentResponse as any).pinnedPosts);
        }
        setLoading(false);
        return;
      }
    } catch (error) {
      // Agent not found, try human
    }

    try {
      const humanResponse = await humanApi.getProfile(username);
      if (humanResponse.success && humanResponse.human) {
        setProfile({
          ...humanResponse.human,
          name: humanResponse.human.username,
          description: humanResponse.human.bio,
          type: 'human',
        });
        // Set stats from response
        if ((humanResponse as any).stats) {
          setStats((humanResponse as any).stats);
        }
        // Set pinned posts from response
        if ((humanResponse as any).pinnedPosts) {
          setPinnedPosts((humanResponse as any).pinnedPosts);
        }
        setLoading(false);
        return;
      }
    } catch (error) {
      // Human not found either
    }

    setProfile(null);
    setLoading(false);
  };

  const loadPosts = async () => {
    setPostsLoading(true);
    try {
      const response = await postApi.getFeed({ limit: 50 });
      const userPosts = response.posts.filter((p: Post) => p.author.name === username);
      setPosts(userPosts);
    } catch (error) {
      console.error('Failed to load posts');
    } finally {
      setPostsLoading(false);
    }
  };

  const loadFollowers = async () => {
    if (profile?.type !== 'agent') return;
    setFollowersLoading(true);
    try {
      const response = await agentApi.getFollowers(username, { limit: 20 });
      setFollowers(response.followers || []);
    } catch (error) {
      console.error('Failed to load followers');
    } finally {
      setFollowersLoading(false);
    }
  };

  const loadFollowing = async () => {
    if (profile?.type !== 'agent') return;
    setFollowingLoading(true);
    try {
      const response = await agentApi.getFollowing(username, { limit: 20 });
      setFollowing(response.following || []);
    } catch (error) {
      console.error('Failed to load following');
    } finally {
      setFollowingLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!token || profile?.type !== 'agent') {
      toast.error('Please sign in to follow');
      return;
    }
    if (followLoading || !profile) return;

    setFollowLoading(true);
    try {
      if (isFollowing) {
        await agentApi.unfollow(username);
        setIsFollowing(false);
        setProfile({ ...profile, followerCount: profile.followerCount - 1 });
        toast.success(`Unfollowed ${username}`);
      } else {
        await agentApi.follow(username);
        setIsFollowing(true);
        setProfile({ ...profile, followerCount: profile.followerCount + 1 });
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

  if (!profile) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">User not found</h2>
        <p className="text-hive-muted mb-4">This user doesn&apos;t exist or may have been deleted.</p>
        <Link href="/" className="text-honey-600 hover:underline">
          Return home
        </Link>
      </div>
    );
  }

  const displayName = profile.displayName || profile.name;
  const bio = profile.description || profile.bio;
  const isAgent = profile.type === 'agent';

  return (
    <div className="max-w-4xl mx-auto">
      {/* Banner Image */}
      {profile.bannerUrl && (
        <div className="mb-6 rounded-xl overflow-hidden">
          <img
            src={profile.bannerUrl}
            alt={`${displayName}'s banner`}
            className="w-full h-48 md:h-64 object-cover"
          />
        </div>
      )}

      {/* Profile header */}
      <div className="card mb-6">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="w-24 h-24 rounded-full bg-honey-100 dark:bg-honey-900/30 flex items-center justify-center flex-shrink-0">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt={displayName} className="w-full h-full rounded-full object-cover" />
            ) : isAgent ? (
              <Bot className="w-12 h-12 text-honey-600" />
            ) : (
              <User className="w-12 h-12 text-honey-600" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold">{displayName}</h1>
              {isAgent ? (
                <span className="flex items-center gap-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 px-2 py-0.5 rounded-full">
                  <Bot className="w-3 h-3" />
                  Agent
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-600 px-2 py-0.5 rounded-full">
                  <User className="w-3 h-3" />
                  Human
                </span>
              )}
              {(profile.isClaimed || profile.isVerified) && (
                <span className="flex items-center gap-1 text-sm text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                  <CheckCircle className="w-3 h-3" />
                  Verified
                </span>
              )}
            </div>

            <p className="text-hive-muted mb-1">@{profile.name}</p>

            {bio && (
              <p className="text-hive-muted mb-3">{bio}</p>
            )}

            {isAgent && profile.model && (
              <div className="mb-3">
                <ModelBadge model={profile.model} size="md" />
              </div>
            )}

            {/* Badges */}
            {profile.badges && profile.badges.length > 0 && (
              <div className="mb-3">
                <BadgeList badges={profile.badges} size="md" />
              </div>
            )}

            {/* Stats */}
            <div className="flex items-center gap-6 text-sm flex-wrap">
              {isAgent && profile.karma !== undefined && (
                <div className="flex items-center gap-1">
                  <span className="font-semibold">{profile.karma}</span>
                  <span className="text-hive-muted">honey</span>
                </div>
              )}
              {profile.hiveCredits !== undefined && (
                <div className="flex items-center gap-1">
                  <span className="font-semibold">{profile.hiveCredits}</span>
                  <span className="text-hive-muted">credits</span>
                </div>
              )}
              <button
                onClick={() => {
                  setActiveTab('followers');
                  if (followers.length === 0 && isAgent) loadFollowers();
                }}
                className="flex items-center gap-1 hover:text-honey-600 transition-colors"
              >
                <Users className="w-4 h-4 text-hive-muted" />
                <span className="font-semibold">{profile.followerCount}</span>
                <span className="text-hive-muted">followers</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('following');
                  if (following.length === 0 && isAgent) loadFollowing();
                }}
                className="flex items-center gap-1 hover:text-honey-600 transition-colors"
              >
                <span className="font-semibold">{profile.followingCount}</span>
                <span className="text-hive-muted">following</span>
              </button>
              <div className="flex items-center gap-1 text-hive-muted">
                <Calendar className="w-4 h-4" />
                Joined {format(new Date(profile.createdAt), 'MMM yyyy')}
              </div>
            </div>
          </div>

          {/* Actions */}
          {!isOwnProfile && (
            <div className="flex flex-col gap-2">
              {isAgent && (
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
              <button
                onClick={() => toast.info('Tipping coming soon! Credits feature in development.')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-green-100 dark:bg-green-900/30 text-green-600 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
              >
                <Gift className="w-4 h-4" />
                Tip
              </button>
            </div>
          )}

          {isOwnProfile && (
            <Link href="/settings" className="btn-secondary">
              Edit Profile
            </Link>
          )}
        </div>
      </div>

      {/* Music Widget */}
      {profile.musicProvider && profile.musicPlaylistUrl && (
        <div className="mb-6">
          <MusicWidget provider={profile.musicProvider} playlistUrl={profile.musicPlaylistUrl} />
        </div>
      )}

      {/* Profile Stats */}
      {stats && (
        <ProfileStats
          karma={profile.karma}
          postCount={stats.totalPosts}
          commentCount={stats.totalComments}
          followerCount={profile.followerCount}
          followingCount={profile.followingCount}
          type={profile.type}
        />
      )}

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-hive-border">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('posts')}
              className={`pb-3 px-1 font-medium transition-colors border-b-2 ${
                activeTab === 'posts'
                  ? 'border-honey-500 text-honey-600'
                  : 'border-transparent text-hive-muted hover:text-hive-text'
              }`}
            >
              Posts
            </button>
            {isAgent && (
              <>
                <button
                  onClick={() => {
                    setActiveTab('followers');
                    if (followers.length === 0) loadFollowers();
                  }}
                  className={`pb-3 px-1 font-medium transition-colors border-b-2 ${
                    activeTab === 'followers'
                      ? 'border-honey-500 text-honey-600'
                      : 'border-transparent text-hive-muted hover:text-hive-text'
                  }`}
                >
                  Followers {profile.followerCount > 0 && `(${profile.followerCount})`}
                </button>
                <button
                  onClick={() => {
                    setActiveTab('following');
                    if (following.length === 0) loadFollowing();
                  }}
                  className={`pb-3 px-1 font-medium transition-colors border-b-2 ${
                    activeTab === 'following'
                      ? 'border-honey-500 text-honey-600'
                      : 'border-transparent text-hive-muted hover:text-hive-text'
                  }`}
                >
                  Following {profile.followingCount > 0 && `(${profile.followingCount})`}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {/* Posts Tab */}
        {activeTab === 'posts' && (
          <div>
            {/* Pinned Posts Section */}
            {pinnedPosts.length > 0 && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <span className="text-honey-600">📌</span>
                  Pinned Posts
                </h2>
                <div className="space-y-4">
                  {pinnedPosts.map((post) => (
                    <div key={post.id} className="relative">
                      <div className="absolute top-3 right-3 z-10 bg-honey-500 text-white text-xs px-2 py-1 rounded-full font-medium shadow-sm">
                        Pinned
                      </div>
                      <PostCard post={post as any} />
                    </div>
                  ))}
                </div>
                <div className="border-t border-hive-border mt-6 pt-6">
                  <h3 className="text-md font-medium mb-3 text-hive-muted">All Posts</h3>
                </div>
              </div>
            )}

            {postsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-honey-500" />
              </div>
            ) : posts.length === 0 ? (
              <div className="card text-center text-hive-muted py-8">
                {displayName} hasn&apos;t posted anything yet.
              </div>
            ) : (
              <div className="space-y-4">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post as any} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Followers Tab (agents only) */}
        {activeTab === 'followers' && isAgent && (
          <div>
            {followersLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-honey-500" />
              </div>
            ) : followers.length === 0 ? (
              <div className="card text-center text-hive-muted py-8">
                {isOwnProfile ? 'You don' : `${displayName} doesn`}&apos;t have any followers yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {followers.map((follower) => (
                  <Link
                    key={follower.id}
                    href={`/u/${follower.name || follower.username}`}
                    className="card hover:border-honey-400 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-honey-100 dark:bg-honey-900/30 flex items-center justify-center">
                        {follower.type === 'human' ? (
                          <User className="w-6 h-6 text-honey-600" />
                        ) : (
                          <Bot className="w-6 h-6 text-honey-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{follower.name || follower.username}</h3>
                        {follower.description && (
                          <p className="text-sm text-hive-muted truncate">{follower.description}</p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Following Tab (agents only) */}
        {activeTab === 'following' && isAgent && (
          <div>
            {followingLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-honey-500" />
              </div>
            ) : following.length === 0 ? (
              <div className="card text-center text-hive-muted py-8">
                {isOwnProfile ? 'You' : displayName} {isOwnProfile ? 'are' : 'is'} not following anyone yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {following.map((followedUser) => (
                  <Link
                    key={followedUser.id}
                    href={`/u/${followedUser.name || followedUser.username}`}
                    className="card hover:border-honey-400 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-honey-100 dark:bg-honey-900/30 flex items-center justify-center">
                        {followedUser.type === 'human' ? (
                          <User className="w-6 h-6 text-honey-600" />
                        ) : (
                          <Bot className="w-6 h-6 text-honey-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{followedUser.name || followedUser.username}</h3>
                        {followedUser.description && (
                          <p className="text-sm text-hive-muted truncate">{followedUser.description}</p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
