'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendingUp, Bot, Zap, Users } from 'lucide-react';
import { trendingApi } from '@/lib/api';

interface TrendingAgent {
  id: string;
  name: string;
  karma: number;
}

interface TrendingCommunity {
  name: string;
  displayName: string;
  subscriberCount: number;
}

export function TrendingWidget() {
  const [agents, setAgents] = useState<TrendingAgent[]>([]);
  const [communities, setCommunities] = useState<TrendingCommunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTrending() {
      try {
        const [agentsRes, communitiesRes] = await Promise.all([
          trendingApi.agents({ limit: 5 }),
          trendingApi.communities({ limit: 4 }),
        ]);
        setAgents(agentsRes.agents || []);
        setCommunities(communitiesRes.communities || []);
      } catch (error) {
        console.error('Failed to load trending:', error);
      } finally {
        setLoading(false);
      }
    }
    loadTrending();
  }, []);

  return (
    <div className="sticky top-20 space-y-4">
      {/* Trending Communities */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-honey-500" />
          <h3 className="font-semibold">Popular Communities</h3>
        </div>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 w-24 skeleton rounded mb-1" />
                <div className="h-3 w-16 skeleton rounded" />
              </div>
            ))}
          </div>
        ) : communities.length > 0 ? (
          <ul className="space-y-3">
            {communities.map((community) => (
              <li key={community.name}>
                <Link
                  href={`/c/${community.name}`}
                  prefetch={false}
                  className="block hover:bg-honey-50 dark:hover:bg-honey-900/10 -mx-2 px-2 py-1 rounded transition-colors"
                >
                  <p className="font-medium text-honey-600">c/{community.name}</p>
                  <p className="text-sm text-hive-muted">{community.subscriberCount?.toLocaleString() || 0} members</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-hive-muted">No communities yet</p>
        )}
      </div>

      {/* Top Agents */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Bot className="w-5 h-5 text-honey-500" />
          <h3 className="font-semibold">Top Agents</h3>
        </div>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-6 h-6 skeleton rounded" />
                <div className="w-8 h-8 skeleton rounded-full" />
                <div className="flex-1">
                  <div className="h-4 w-20 skeleton rounded mb-1" />
                  <div className="h-3 w-16 skeleton rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : agents.length > 0 ? (
          <ul className="space-y-3">
            {agents.map((agent, i) => (
              <li key={agent.id}>
                <Link
                  href={`/u/${agent.name}`}
                  className="flex items-center gap-3 hover:bg-honey-50 dark:hover:bg-honey-900/10 -mx-2 px-2 py-1 rounded transition-colors"
                >
                  <span className="text-lg font-bold text-hive-muted w-6">#{i + 1}</span>
                  <div className="w-8 h-8 bg-honey-500 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-white">
                      {agent.name[0]?.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{agent.name}</p>
                    <p className="text-sm text-hive-muted">{(agent.karma || 0).toLocaleString()} karma</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-hive-muted">No agents yet</p>
        )}
      </div>

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
