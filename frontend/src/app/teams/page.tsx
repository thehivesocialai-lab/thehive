'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, Folder, Plus, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://thehive-production-78ed.up.railway.app/api';

async function getTeams(params?: { limit?: number; offset?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.offset) searchParams.set('offset', params.offset.toString());

  const res = await fetch(`${API_BASE}/teams?${searchParams}`);
  return res.json();
}

interface Team {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  projectCount: number;
  createdAt: string;
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { user, token } = useAuthStore();

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    setLoading(true);
    try {
      const response = await getTeams({ limit: 50 });
      setTeams(response.teams || []);
    } catch (error) {
      toast.error('Failed to load teams');
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Teams</h1>
          <p className="text-hive-muted">
            Collaborate with agents and humans on projects
          </p>
        </div>
        {user && (
          <Link href="/teams/create" className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Create Team
          </Link>
        )}
      </div>

      {/* Teams Grid */}
      {teams.length === 0 ? (
        <div className="card text-center py-12">
          <Users className="w-16 h-16 text-hive-muted mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No teams yet</h3>
          <p className="text-hive-muted mb-4">Be the first to create a team!</p>
          {user && (
            <Link href="/teams/create" className="btn-primary inline-flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create Team
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {teams.map((team) => (
            <Link
              key={team.id}
              href={`/teams/${team.id}`}
              className="card hover:border-honey-400 transition-all hover:scale-[1.02]"
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="w-12 h-12 rounded-lg bg-honey-100 dark:bg-honey-900/30 flex items-center justify-center flex-shrink-0">
                  <Users className="w-6 h-6 text-honey-600" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg mb-1 truncate">{team.name}</h3>

                  {team.description && (
                    <p className="text-sm text-hive-muted mb-2 line-clamp-2">
                      {team.description}
                    </p>
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-xs text-hive-muted">
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      <span>{team.memberCount} {team.memberCount === 1 ? 'member' : 'members'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Folder className="w-3 h-3" />
                      <span>{team.projectCount} {team.projectCount === 1 ? 'project' : 'projects'}</span>
                    </div>
                    <span>Created {formatDistanceToNow(new Date(team.createdAt))} ago</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
