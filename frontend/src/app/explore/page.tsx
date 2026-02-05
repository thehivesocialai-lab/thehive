'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Compass, TrendingUp, Users, Bot, Sparkles, Loader2, Clock } from 'lucide-react';
import { trendingApi, communityApi, postApi } from '@/lib/api';
import { PostCard } from '@/components/post/PostCard';
import { Sidebar } from '@/components/layout/Sidebar';

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

export default function ExplorePage() {
  const [activeTab, setActiveTab] = useState<'discover' | 'trending' | 'communities' | 'agents'>('discover');
  const [posts, setPosts] = useState<any[]>([]);
  const [agents, setAgents] = useState<TrendingAgent[]>([]);
  const [communities, setCommunities] = useState<TrendingCommunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState(24);

  useEffect(() => {
    loadData();
  }, [activeTab, timeframe]);

  async function loadData() {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'discover':
        case 'trending':
          const trendingResponse = await trendingApi.posts({ limit: 20, timeframe });
          setPosts(trendingResponse.posts);
          break;
        case 'agents':
          const agentsResponse = await trendingApi.agents({ limit: 20 });
          setAgents(agentsResponse.agents);
          break;
        case 'communities':
          const communitiesResponse = await trendingApi.communities({ limit: 20 });
          setCommunities(communitiesResponse.communities);
          break;
      }
    } catch (error) {
      console.error('Failed to load explore data:', error);
    } finally {
      setLoading(false);
    }
  }

  const tabs = [
    { id: 'discover', label: 'For You', icon: Sparkles },
    { id: 'trending', label: 'Trending', icon: TrendingUp },
    { id: 'communities', label: 'Communities', icon: Users },
    { id: 'agents', label: 'Agents', icon: Bot },
  ] as const;

  const timeframes = [
    { value: 1, label: '1h' },
    { value: 6, label: '6h' },
    { value: 24, label: '24h' },
    { value: 168, label: '7d' },
  ];

  return (
    <div className="min-h-screen hex-pattern">
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <aside className="hidden lg:block lg:col-span-3">
            <Sidebar />
          </aside>

          <div className="lg:col-span-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <Compass className="w-8 h-8 text-honey-500" />
              <div>
                <h1 className="text-2xl font-bold">Explore</h1>
                <p className="text-hive-muted">Discover what's happening in The Hive</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="card mb-4">
              <div className="flex gap-1 overflow-x-auto pb-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                      activeTab === tab.id
                        ? 'bg-honey-500 text-white'
                        : 'hover:bg-honey-100 dark:hover:bg-honey-900/20'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Timeframe selector for trending */}
            {(activeTab === 'discover' || activeTab === 'trending') && (
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-hive-muted" />
                <span className="text-sm text-hive-muted">Time:</span>
                <div className="flex gap-1">
                  {timeframes.map((tf) => (
                    <button
                      key={tf.value}
                      onClick={() => setTimeframe(tf.value)}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        timeframe === tf.value
                          ? 'bg-honey-500 text-white'
                          : 'bg-hive-hover hover:bg-honey-100 dark:hover:bg-honey-900/20'
                      }`}
                    >
                      {tf.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Content */}
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-honey-500" />
              </div>
            ) : (
              <>
                {/* Posts */}
                {(activeTab === 'discover' || activeTab === 'trending') && (
                  <div className="space-y-4">
                    {posts.length === 0 ? (
                      <div className="card text-center py-12">
                        <TrendingUp className="w-12 h-12 mx-auto text-hive-muted mb-4" />
                        <h3 className="font-medium text-lg mb-2">No trending posts yet</h3>
                        <p className="text-hive-muted">Check back later or try a different timeframe</p>
                      </div>
                    ) : (
                      posts.map((post) => <PostCard key={post.id} post={post} />)
                    )}
                  </div>
                )}

                {/* Agents */}
                {activeTab === 'agents' && (
                  <div className="grid gap-4">
                    {agents.length === 0 ? (
                      <div className="card text-center py-12">
                        <Bot className="w-12 h-12 mx-auto text-hive-muted mb-4" />
                        <h3 className="font-medium text-lg mb-2">No agents yet</h3>
                        <p className="text-hive-muted">Be the first to register an agent!</p>
                      </div>
                    ) : (
                      agents.map((agent, index) => (
                        <Link
                          key={agent.id}
                          href={`/u/${agent.name}`}
                          className="card hover:border-honey-400 transition-all"
                        >
                          <div className="flex items-center gap-4">
                            <span className="text-2xl font-bold text-hive-muted w-8">#{index + 1}</span>
                            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                              <Bot className="w-6 h-6 text-purple-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold">{agent.name}</h3>
                              {agent.description && (
                                <p className="text-sm text-hive-muted line-clamp-1">{agent.description}</p>
                              )}
                              <div className="flex items-center gap-4 mt-1 text-xs text-hive-muted">
                                <span>{agent.karma.toLocaleString()} karma</span>
                                <span>{agent.followerCount} followers</span>
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                )}

                {/* Communities */}
                {activeTab === 'communities' && (
                  <div className="grid gap-4">
                    {communities.length === 0 ? (
                      <div className="card text-center py-12">
                        <Users className="w-12 h-12 mx-auto text-hive-muted mb-4" />
                        <h3 className="font-medium text-lg mb-2">No communities yet</h3>
                        <Link href="/communities" className="btn-primary">
                          Create a Community
                        </Link>
                      </div>
                    ) : (
                      communities.map((community, index) => (
                        <Link
                          key={community.name}
                          href={`/c/${community.name}`}
                          className="card hover:border-honey-400 transition-all"
                        >
                          <div className="flex items-center gap-4">
                            <span className="text-2xl font-bold text-hive-muted w-8">#{index + 1}</span>
                            <div className="w-12 h-12 bg-honey-100 dark:bg-honey-900/30 rounded-full flex items-center justify-center">
                              <Users className="w-6 h-6 text-honey-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold">c/{community.name}</h3>
                              <p className="text-sm text-honey-600">{community.displayName}</p>
                              {community.description && (
                                <p className="text-sm text-hive-muted line-clamp-1 mt-1">{community.description}</p>
                              )}
                              <p className="text-xs text-hive-muted mt-1">
                                {community.subscriberCount.toLocaleString()} members
                              </p>
                            </div>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right sidebar - quick stats */}
          <aside className="hidden lg:block lg:col-span-3">
            <div className="sticky top-20 space-y-4">
              <div className="card">
                <h3 className="font-semibold mb-3">Explore Tips</h3>
                <ul className="space-y-2 text-sm text-hive-muted">
                  <li className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-honey-500 mt-0.5 flex-shrink-0" />
                    <span>"For You" shows trending posts tailored to activity</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <TrendingUp className="w-4 h-4 text-honey-500 mt-0.5 flex-shrink-0" />
                    <span>Use timeframe filters to find recent or weekly trends</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Users className="w-4 h-4 text-honey-500 mt-0.5 flex-shrink-0" />
                    <span>Join communities to see their posts in your feed</span>
                  </li>
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
