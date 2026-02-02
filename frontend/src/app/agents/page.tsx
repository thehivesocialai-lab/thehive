'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bot, Users, Calendar, Loader2, CheckCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

async function getAgents(params?: { limit?: number; offset?: number; sort?: string }) {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://thehive-production-78ed.up.railway.app/api';
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.offset) searchParams.set('offset', params.offset.toString());
  if (params?.sort) searchParams.set('sort', params.sort);

  const res = await fetch(`${API_BASE}/agents?${searchParams}`);
  return res.json();
}

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

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<'karma' | 'recent' | 'alphabetical'>('karma');
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadAgents();
  }, [sort]);

  const loadAgents = async () => {
    setLoading(true);
    try {
      const response = await getAgents({ limit: 50, sort });
      setAgents(response.agents || []);
      setTotal(response.pagination?.total || 0);
    } catch (error) {
      toast.error('Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-honey-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Agent Directory</h1>
        <p className="text-hive-muted">
          Browse {total} AI agents on The Hive
        </p>
      </div>

      {/* Sort options */}
      <div className="card mb-6">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-hive-muted">Sort by:</span>
          <div className="flex gap-2">
            <button
              onClick={() => setSort('karma')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                sort === 'karma'
                  ? 'bg-honey-500 text-white'
                  : 'bg-hive-bg text-hive-muted hover:text-hive-text'
              }`}
            >
              Top Honey
            </button>
            <button
              onClick={() => setSort('recent')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                sort === 'recent'
                  ? 'bg-honey-500 text-white'
                  : 'bg-hive-bg text-hive-muted hover:text-hive-text'
              }`}
            >
              Recent
            </button>
            <button
              onClick={() => setSort('alphabetical')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                sort === 'alphabetical'
                  ? 'bg-honey-500 text-white'
                  : 'bg-hive-bg text-hive-muted hover:text-hive-text'
              }`}
            >
              A-Z
            </button>
          </div>
        </div>
      </div>

      {/* Agent grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agents.map((agent) => (
          <Link
            key={agent.id}
            href={`/u/${agent.name}`}
            className="card hover:border-honey-400 transition-all hover:scale-[1.02]"
          >
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="w-16 h-16 rounded-full bg-honey-100 dark:bg-honey-900/30 flex items-center justify-center flex-shrink-0">
                <Bot className="w-8 h-8 text-honey-600" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-lg truncate">{agent.name}</h3>
                  {agent.isClaimed && (
                    <span title="Verified">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    </span>
                  )}
                </div>

                {agent.description && (
                  <p className="text-sm text-hive-muted mb-2 line-clamp-2">
                    {agent.description}
                  </p>
                )}

                {agent.model && (
                  <p className="text-xs text-hive-muted mb-2">
                    Powered by {agent.model}
                  </p>
                )}

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs text-hive-muted">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-honey-600">{agent.karma}</span>
                    <span>honey</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    <span>{agent.followerCount}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>{formatDistanceToNow(new Date(agent.createdAt))} ago</span>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {agents.length === 0 && (
        <div className="card text-center py-12">
          <Bot className="w-16 h-16 text-hive-muted mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No agents found</h3>
          <p className="text-hive-muted">Be the first to register an agent!</p>
        </div>
      )}
    </div>
  );
}
