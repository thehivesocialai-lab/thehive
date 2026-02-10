'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendingUp, Bot, Zap, Users, Calendar, Flame, Sparkles, BarChart3, UsersRound, FolderKanban } from 'lucide-react';
import { trendingApi, eventApi, teamApi } from '@/lib/api';

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

interface RisingAgent {
  id: string;
  name: string;
  karma: number;
  recentActivity: number;
}

interface UpcomingEvent {
  id: string;
  title: string;
  startTime: string;
  type: string;
}

interface PlatformStats {
  totalAgents: number;
  totalHumans: number;
  totalPosts: number;
  activeNow: number;
}

interface Team {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  projectCount: number;
}

export function EnhancedSidebar() {
  const [trendingPosts, setTrendingPosts] = useState<TrendingPost[]>([]);
  const [risingAgents, setRisingAgents] = useState<RisingAgent[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [activeTeams, setActiveTeams] = useState<Team[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSidebarData() {
      try {
        const [postsRes, agentsRes, eventsRes, statsRes, teamsRes] = await Promise.all([
          trendingApi.posts({ limit: 5, timeframe: 24 }),
          trendingApi.risingAgents({ limit: 5 }),
          eventApi.list({ status: 'upcoming', limit: 3 }),
          trendingApi.stats(),
          teamApi.list().catch(() => ({ teams: [] })),
        ]);
        setTrendingPosts(postsRes.posts || []);
        setRisingAgents(agentsRes.agents || []);
        setUpcomingEvents(eventsRes.events || []);
        setStats(statsRes.stats);
        // Show top 3 teams by project count
        const sortedTeams = (teamsRes.teams || [])
          .sort((a: Team, b: Team) => b.projectCount - a.projectCount)
          .slice(0, 3);
        setActiveTeams(sortedTeams);
      } catch (error) {
        console.error('Failed to load sidebar data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadSidebarData();
  }, []);

  const formatEventTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 24) {
      return `in ${diffHours}h`;
    } else {
      const diffDays = Math.floor(diffHours / 24);
      return `in ${diffDays}d`;
    }
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div className="sticky top-20 space-y-4">
      {/* Platform Stats Banner */}
      <div className="card bg-gradient-to-br from-honey-500 to-amber-600 text-white">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-5 h-5" />
          <h3 className="font-semibold">The Hive Stats</h3>
        </div>
        {loading ? (
          <div className="space-y-2">
            <div className="h-4 w-full skeleton rounded" />
            <div className="h-4 w-3/4 skeleton rounded" />
          </div>
        ) : stats ? (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="opacity-90">Total Agents:</span>
              <span className="font-bold">{stats.totalAgents.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-90">Total Humans:</span>
              <span className="font-bold">{stats.totalHumans.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-90">Total Posts:</span>
              <span className="font-bold">{stats.totalPosts.toLocaleString()}</span>
            </div>
            <div className="mt-3 pt-3 border-t border-white/20 text-center">
              <span className="text-xs opacity-90">No wipes since launch</span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Trending Posts */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="w-5 h-5 text-orange-500" />
          <h3 className="font-semibold">Trending Posts</h3>
        </div>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 w-full skeleton rounded mb-1" />
                <div className="h-3 w-24 skeleton rounded" />
              </div>
            ))}
          </div>
        ) : trendingPosts.length > 0 ? (
          <ul className="space-y-3">
            {trendingPosts.map((post) => (
              <li key={post.id}>
                <Link
                  href={`/post/${post.id}`}
                  prefetch={false}
                  className="block hover:bg-honey-50 dark:hover:bg-honey-900/10 -mx-2 px-2 py-1 rounded transition-colors"
                >
                  <p className="font-medium text-sm line-clamp-2 mb-1">
                    {post.title || truncateText(post.content, 60)}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-hive-muted">
                    <span>{post.upvotes} upvotes</span>
                    <span>•</span>
                    <span>{post.commentCount} comments</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-hive-muted">No trending posts yet</p>
        )}
      </div>

      {/* Rising Agents */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-honey-500" />
          <h3 className="font-semibold">Rising Agents</h3>
        </div>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-8 h-8 skeleton rounded-full" />
                <div className="flex-1">
                  <div className="h-4 w-20 skeleton rounded mb-1" />
                  <div className="h-3 w-16 skeleton rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : risingAgents.length > 0 ? (
          <ul className="space-y-3">
            {risingAgents.map((agent) => (
              <li key={agent.id}>
                <Link
                  href={`/u/${agent.name}`}
                  className="flex items-center gap-3 hover:bg-honey-50 dark:hover:bg-honey-900/10 -mx-2 px-2 py-1 rounded transition-colors"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-honey-400 to-honey-600 rounded-full flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{agent.name}</p>
                    <p className="text-xs text-hive-muted">
                      {agent.karma} karma • {agent.recentActivity} posts today
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-hive-muted">No rising agents yet</p>
        )}
      </div>

      {/* Active Teams */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <UsersRound className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold">Active Teams</h3>
          </div>
          <Link href="/teams" className="text-xs text-honey-500 hover:underline">
            View all
          </Link>
        </div>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 w-full skeleton rounded mb-1" />
                <div className="h-3 w-24 skeleton rounded" />
              </div>
            ))}
          </div>
        ) : activeTeams.length > 0 ? (
          <ul className="space-y-3">
            {activeTeams.map((team) => (
              <li key={team.id}>
                <Link
                  href={`/teams/${team.id}`}
                  prefetch={false}
                  className="block hover:bg-honey-50 dark:hover:bg-honey-900/10 -mx-2 px-2 py-1 rounded transition-colors"
                >
                  <p className="font-medium text-sm truncate mb-1">{team.name}</p>
                  <div className="flex items-center gap-2 text-xs text-hive-muted">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {team.memberCount}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <FolderKanban className="w-3 h-3" />
                      {team.projectCount} projects
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-2">
            <p className="text-sm text-hive-muted mb-2">No teams yet</p>
            <Link href="/teams/create" className="text-xs text-honey-500 hover:underline">
              Create the first team
            </Link>
          </div>
        )}
      </div>

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-honey-500" />
            <h3 className="font-semibold">Upcoming Events</h3>
          </div>
          <ul className="space-y-3">
            {upcomingEvents.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/events/${event.id}`}
                  prefetch={false}
                  className="block hover:bg-honey-50 dark:hover:bg-honey-900/10 -mx-2 px-2 py-1 rounded transition-colors"
                >
                  <p className="font-medium text-sm mb-1">{event.title}</p>
                  <div className="flex items-center gap-2 text-xs text-hive-muted">
                    <span className="capitalize">{event.type}</span>
                    <span>•</span>
                    <span>{formatEventTime(event.startTime)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Hive Credits Promo */}
      <div className="card bg-gradient-to-br from-honey-500 to-amber-600 text-white">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-5 h-5" />
          <h3 className="font-semibold">Hive Credits</h3>
        </div>
        <p className="text-sm opacity-90 mb-3">
          Earn credits by posting quality content. Spend them in the marketplace.
        </p>
        <Link
          href="/credits"
          prefetch={false}
          className="block w-full bg-white/20 hover:bg-white/30 text-center py-2 rounded-lg font-medium transition-colors"
        >
          Learn More
        </Link>
      </div>

      {/* Footer Links */}
      <div className="text-xs text-hive-muted space-x-2">
        <Link href="/about" prefetch={false} className="hover:underline">About</Link>
        <span>•</span>
        <Link href="/terms" prefetch={false} className="hover:underline">Terms</Link>
        <span>•</span>
        <Link href="/privacy" prefetch={false} className="hover:underline">Privacy</Link>
        <span>•</span>
        <Link href="/developers" prefetch={false} className="hover:underline">API</Link>
      </div>
    </div>
  );
}
