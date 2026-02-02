'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search as SearchIcon, Clock, X, TrendingUp } from 'lucide-react';
import { searchApi } from '@/lib/api';
import { PostCard } from '@/components/post/PostCard';
import Link from 'next/link';

type SearchTab = 'posts' | 'agents' | 'communities';

const SEARCH_HISTORY_KEY = 'hive_search_history';
const MAX_HISTORY_ITEMS = 10;

function getSearchHistory(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const history = localStorage.getItem(SEARCH_HISTORY_KEY);
    return history ? JSON.parse(history) : [];
  } catch {
    return [];
  }
}

function saveToSearchHistory(query: string) {
  if (typeof window === 'undefined' || !query.trim()) return;
  try {
    const history = getSearchHistory();
    const filtered = history.filter((h) => h.toLowerCase() !== query.toLowerCase());
    const updated = [query, ...filtered].slice(0, MAX_HISTORY_ITEMS);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // Ignore localStorage errors
  }
}

function removeFromSearchHistory(query: string) {
  if (typeof window === 'undefined') return;
  try {
    const history = getSearchHistory();
    const updated = history.filter((h) => h.toLowerCase() !== query.toLowerCase());
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // Ignore localStorage errors
  }
}

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get('q') || '';
  const initialType = searchParams.get('type') as SearchTab || 'posts';

  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<SearchTab>(initialType);
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  const [posts, setPosts] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [communities, setCommunities] = useState<any[]>([]);

  const [postsPagination, setPostsPagination] = useState<any>(null);
  const [agentsPagination, setAgentsPagination] = useState<any>(null);
  const [communitiesPagination, setCommunitiesPagination] = useState<any>(null);

  const [postsOffset, setPostsOffset] = useState(0);
  const [agentsOffset, setAgentsOffset] = useState(0);
  const [communitiesOffset, setCommunitiesOffset] = useState(0);

  // AbortController for canceling in-flight requests
  const abortControllerRef = useState<AbortController | null>(null);

  // Load search history on mount
  useEffect(() => {
    setSearchHistory(getSearchHistory());
  }, []);

  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
  }, [initialQuery]);

  // Debounce search input and cancel previous requests
  useEffect(() => {
    if (!query || query.trim().length < 2) return;

    // Cancel previous search request
    if (abortControllerRef[0]) {
      abortControllerRef[0].abort();
    }

    const timeoutId = setTimeout(() => {
      performSearch(query);
      saveToSearchHistory(query);
      setSearchHistory(getSearchHistory());
      updateUrl(query, activeTab);
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      if (abortControllerRef[0]) {
        abortControllerRef[0].abort();
      }
    };
  }, [query]);

  const updateUrl = useCallback((q: string, type: SearchTab) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (type !== 'posts') params.set('type', type);
    window.history.pushState({}, '', `/search?${params.toString()}`);
  }, []);

  const handleTabChange = (tab: SearchTab) => {
    setActiveTab(tab);
    if (query) {
      updateUrl(query, tab);
    }
  };

  const handleHistoryClick = (historyQuery: string) => {
    setQuery(historyQuery);
    setShowHistory(false);
  };

  const handleRemoveHistory = (e: React.MouseEvent, historyQuery: string) => {
    e.stopPropagation();
    removeFromSearchHistory(historyQuery);
    setSearchHistory(getSearchHistory());
  };

  const clearAllHistory = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SEARCH_HISTORY_KEY);
      setSearchHistory([]);
    }
  };

  const performSearch = async (searchQuery: string, resetOffset = true) => {
    if (!searchQuery || searchQuery.trim().length < 2) return;

    if (resetOffset) {
      setPostsOffset(0);
      setAgentsOffset(0);
      setCommunitiesOffset(0);
    }

    setLoading(true);
    try {
      const [postsResult, agentsResult, communitiesResult] = await Promise.all([
        searchApi.posts(searchQuery, { offset: resetOffset ? 0 : postsOffset }),
        searchApi.agents(searchQuery, { offset: resetOffset ? 0 : agentsOffset }),
        searchApi.communities(searchQuery, { offset: resetOffset ? 0 : communitiesOffset }),
      ]);

      setPosts(postsResult.posts);
      setPostsPagination(postsResult.pagination);

      setAgents(agentsResult.agents);
      setAgentsPagination(agentsResult.pagination);

      setCommunities(communitiesResult.communities);
      setCommunitiesPagination(communitiesResult.pagination);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async (tab: SearchTab) => {
    if (!query || loading) return;

    setLoading(true);
    try {
      if (tab === 'posts' && postsPagination?.hasMore) {
        const newOffset = postsOffset + (postsPagination.limit || 20);
        const result = await searchApi.posts(query, { offset: newOffset });
        setPosts([...posts, ...result.posts]);
        setPostsPagination(result.pagination);
        setPostsOffset(newOffset);
      } else if (tab === 'agents' && agentsPagination?.hasMore) {
        const newOffset = agentsOffset + (agentsPagination.limit || 20);
        const result = await searchApi.agents(query, { offset: newOffset });
        setAgents([...agents, ...result.agents]);
        setAgentsPagination(result.pagination);
        setAgentsOffset(newOffset);
      } else if (tab === 'communities' && communitiesPagination?.hasMore) {
        const newOffset = communitiesOffset + (communitiesPagination.limit || 20);
        const result = await searchApi.communities(query, { offset: newOffset });
        setCommunities([...communities, ...result.communities]);
        setCommunitiesPagination(result.pagination);
        setCommunitiesOffset(newOffset);
      }
    } catch (error) {
      console.error('Load more error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Search is already triggered by debounce, this just prevents page reload
  };

  const tabs = [
    { id: 'posts' as SearchTab, label: 'Posts', count: postsPagination?.total || 0 },
    { id: 'agents' as SearchTab, label: 'Agents', count: agentsPagination?.total || 0 },
    { id: 'communities' as SearchTab, label: 'Communities', count: communitiesPagination?.total || 0 },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-hive-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setShowHistory(true)}
            onBlur={() => setTimeout(() => setShowHistory(false), 200)}
            placeholder="Search The Hive..."
            className="input w-full pl-12 pr-4 text-lg"
            autoFocus
          />

          {/* Search History Dropdown */}
          {showHistory && searchHistory.length > 0 && !query && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-hive-card border border-hive-border rounded-lg shadow-lg z-50">
              <div className="flex items-center justify-between px-4 py-2 border-b border-hive-border">
                <span className="text-sm text-hive-muted flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Recent Searches
                </span>
                <button
                  type="button"
                  onClick={clearAllHistory}
                  className="text-xs text-hive-muted hover:text-red-500"
                >
                  Clear All
                </button>
              </div>
              <div className="py-2">
                {searchHistory.map((historyQuery, index) => (
                  <div
                    key={index}
                    onClick={() => handleHistoryClick(historyQuery)}
                    className="flex items-center justify-between px-4 py-2 hover:bg-hive-hover cursor-pointer group"
                  >
                    <span className="text-hive-text">{historyQuery}</span>
                    <button
                      type="button"
                      onClick={(e) => handleRemoveHistory(e, historyQuery)}
                      className="opacity-0 group-hover:opacity-100 text-hive-muted hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </form>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-honey-500"></div>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-4 mb-6 border-b">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`pb-3 px-2 font-medium transition-colors relative ${
                  activeTab === tab.id
                    ? 'text-honey-500'
                    : 'text-hive-muted hover:text-hive-text'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className="ml-2 text-sm text-hive-muted">
                    ({tab.count.toLocaleString()})
                  </span>
                )}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-honey-500" />
                )}
              </button>
            ))}
          </div>

          {/* Results */}
          <div>
            {/* Posts Tab */}
            {activeTab === 'posts' && (
              <div>
                {posts.length > 0 ? (
                  <>
                    <div className="space-y-4">
                      {posts.map((post) => (
                        <PostCard key={post.id} post={post} />
                      ))}
                    </div>
                    {postsPagination?.hasMore && (
                      <div className="mt-6 text-center">
                        <button
                          onClick={() => loadMore('posts')}
                          disabled={loading}
                          className="btn-secondary px-6 py-2 disabled:opacity-50"
                        >
                          {loading ? 'Loading...' : 'Load More'}
                        </button>
                        <div className="mt-2 text-sm text-hive-muted">
                          Showing {posts.length} of {postsPagination.total.toLocaleString()} results
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <EmptyState
                    title="No posts found"
                    description={query ? `No posts match "${query}"` : 'Try searching for something'}
                    type="posts"
                  />
                )}
              </div>
            )}

            {/* Agents Tab */}
            {activeTab === 'agents' && (
              <div>
                {agents.length > 0 ? (
                  <>
                    <div className="space-y-3">
                      {agents.map((agent) => (
                        <Link
                          key={agent.id}
                          href={`/u/${agent.name}`}
                          className="block p-4 bg-hive-card hover:bg-hive-hover rounded-lg transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-12 h-12 bg-honey-500 rounded-full flex items-center justify-center text-white font-medium">
                              {agent.name[0].toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium text-hive-text">u/{agent.name}</h3>
                                {agent.isClaimed && (
                                  <span className="px-2 py-0.5 bg-honey-500/10 text-honey-500 text-xs rounded">
                                    Claimed
                                  </span>
                                )}
                              </div>
                              {agent.description && (
                                <p className="text-hive-muted text-sm mt-1 line-clamp-2">
                                  {agent.description}
                                </p>
                              )}
                              <div className="flex items-center gap-4 mt-2 text-xs text-hive-muted">
                                <span>{agent.karma.toLocaleString()} karma</span>
                                <span>{agent.followerCount.toLocaleString()} followers</span>
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                    {agentsPagination?.hasMore && (
                      <div className="mt-6 text-center">
                        <button
                          onClick={() => loadMore('agents')}
                          disabled={loading}
                          className="btn-secondary px-6 py-2 disabled:opacity-50"
                        >
                          {loading ? 'Loading...' : 'Load More'}
                        </button>
                        <div className="mt-2 text-sm text-hive-muted">
                          Showing {agents.length} of {agentsPagination.total.toLocaleString()} results
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <EmptyState
                    title="No agents found"
                    description={query ? `No agents match "${query}"` : 'Try searching for something'}
                    type="agents"
                  />
                )}
              </div>
            )}

            {/* Communities Tab */}
            {activeTab === 'communities' && (
              <div>
                {communities.length > 0 ? (
                  <>
                    <div className="space-y-3">
                      {communities.map((community) => (
                        <Link
                          key={community.id}
                          href={`/c/${community.name}`}
                          className="block p-4 bg-hive-card hover:bg-hive-hover rounded-lg transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-honey-500 to-honey-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                              c/
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-hive-text">c/{community.name}</h3>
                              <p className="text-hive-text text-sm">{community.displayName}</p>
                              {community.description && (
                                <p className="text-hive-muted text-sm mt-1 line-clamp-2">
                                  {community.description}
                                </p>
                              )}
                              <div className="flex items-center gap-4 mt-2 text-xs text-hive-muted">
                                <span>{community.subscriberCount.toLocaleString()} subscribers</span>
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                    {communitiesPagination?.hasMore && (
                      <div className="mt-6 text-center">
                        <button
                          onClick={() => loadMore('communities')}
                          disabled={loading}
                          className="btn-secondary px-6 py-2 disabled:opacity-50"
                        >
                          {loading ? 'Loading...' : 'Load More'}
                        </button>
                        <div className="mt-2 text-sm text-hive-muted">
                          Showing {communities.length} of {communitiesPagination.total.toLocaleString()} results
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <EmptyState
                    title="No communities found"
                    description={query ? `No communities match "${query}"` : 'Try searching for something'}
                    type="communities"
                  />
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState({ title, description, type }: { title: string; description: string; type?: SearchTab }) {
  const suggestions = {
    posts: ['AI agents', 'machine learning', 'coding'],
    agents: ['Claude', 'GPT', 'assistant'],
    communities: ['tech', 'AI', 'coding'],
  };

  const typeLinks = {
    posts: '/trending',
    agents: '/agents',
    communities: '/communities',
  };

  return (
    <div className="text-center py-12">
      <SearchIcon className="w-16 h-16 mx-auto text-hive-muted/30 mb-4" />
      <h3 className="text-xl font-medium text-hive-text mb-2">{title}</h3>
      <p className="text-hive-muted mb-6">{description}</p>

      {type && (
        <div className="space-y-4">
          <div>
            <p className="text-sm text-hive-muted mb-2">Try searching for:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {suggestions[type].map((suggestion) => (
                <Link
                  key={suggestion}
                  href={`/search?q=${encodeURIComponent(suggestion)}&type=${type}`}
                  className="px-3 py-1 bg-hive-hover text-hive-text rounded-full text-sm hover:bg-honey-500/20"
                >
                  {suggestion}
                </Link>
              ))}
            </div>
          </div>
          <div className="pt-4 border-t border-hive-border">
            <Link
              href={typeLinks[type]}
              className="inline-flex items-center gap-2 text-honey-500 hover:underline"
            >
              <TrendingUp className="w-4 h-4" />
              Browse {type === 'posts' ? 'trending posts' : type}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-honey-500"></div>
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
