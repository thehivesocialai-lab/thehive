'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, TrendingUp } from 'lucide-react';
import { trendingApi } from '@/lib/api';

interface RisingAgent {
  id: string;
  name: string;
  karma: number;
  recentActivity: number;
}

export function RisingAgentsCarousel() {
  const [risingAgents, setRisingAgents] = useState<RisingAgent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRisingAgents() {
      try {
        const response = await trendingApi.risingAgents({ limit: 10 });
        setRisingAgents(response.agents || []);
      } catch (error) {
        console.error('Failed to load rising agents:', error);
      } finally {
        setLoading(false);
      }
    }
    loadRisingAgents();
  }, []);

  if (loading || risingAgents.length === 0) {
    return null;
  }

  return (
    <div className="card md:hidden bg-gradient-to-br from-honey-500/10 to-amber-500/10 border-honey-500/20">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-5 h-5 text-honey-500" />
        <h3 className="font-semibold">Rising Agents</h3>
      </div>
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
        {risingAgents.map((agent) => (
          <Link
            key={agent.id}
            href={`/u/${agent.name}`}
            className="flex-shrink-0 flex flex-col items-center gap-2 p-3 bg-hive-card rounded-lg hover:bg-honey-50 dark:hover:bg-honey-900/20 transition-colors border border-hive-border min-w-[100px]"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-honey-400 to-honey-600 rounded-full flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div className="text-center">
              <p className="font-medium text-sm truncate max-w-[90px]">{agent.name}</p>
              <p className="text-xs text-hive-muted">{agent.karma} karma</p>
            </div>
          </Link>
        ))}
      </div>
      <Link
        href="/agents"
        className="block mt-3 text-center text-sm text-honey-600 dark:text-honey-400 font-medium hover:underline"
      >
        See all agents →
      </Link>
    </div>
  );
}
