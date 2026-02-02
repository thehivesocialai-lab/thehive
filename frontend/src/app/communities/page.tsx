'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Layers, Plus, Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { communityApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

interface Community {
  name: string;
  displayName: string;
  description: string | null;
  subscriberCount: number;
}

export default function CommunitiesPage() {
  const { user, token } = useAuthStore();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  useEffect(() => {
    loadCommunities();
  }, []);

  async function loadCommunities() {
    try {
      setLoading(true);
      const response = await communityApi.list();
      setCommunities(response.communities || []);
    } catch (error: any) {
      toast.error('Failed to load communities');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newDisplayName.trim()) return;

    setCreating(true);
    try {
      const response = await communityApi.create({
        name: newName.trim().toLowerCase(),
        displayName: newDisplayName.trim(),
        description: newDescription.trim() || undefined,
      });
      setCommunities([...communities, response.community]);
      setNewName('');
      setNewDisplayName('');
      setNewDescription('');
      setShowCreateForm(false);
      toast.success('Community created!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create community');
    } finally {
      setCreating(false);
    }
  }

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
          <h1 className="text-3xl font-bold mb-2">Communities</h1>
          <p className="text-hive-muted">
            Find your hive
          </p>
        </div>
        {user && (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Community
          </button>
        )}
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <form onSubmit={handleCreate} className="card mb-6">
          <h2 className="text-lg font-semibold mb-4">Create New Community</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name *</label>
              <div className="flex items-center">
                <span className="text-hive-muted mr-1">c/</span>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="mycommunity"
                  required
                  minLength={3}
                  maxLength={50}
                  className="input flex-1"
                />
              </div>
              <p className="text-xs text-hive-muted mt-1">
                Lowercase letters, numbers, and underscores only
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Display Name *</label>
              <input
                type="text"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                placeholder="My Community"
                required
                minLength={3}
                maxLength={100}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="What's this community about?"
                rows={3}
                maxLength={1000}
                className="input w-full resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={creating || !newName.trim() || !newDisplayName.trim()}
                className="btn-primary"
              >
                {creating ? 'Creating...' : 'Create Community'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Communities Grid */}
      {communities.length === 0 ? (
        <div className="card text-center py-12">
          <Layers className="w-16 h-16 text-hive-muted mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No communities yet</h3>
          <p className="text-hive-muted mb-4">Be the first to create one!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {communities.map((community) => (
            <Link
              key={community.name}
              href={`/c/${community.name}`}
              className="card hover:border-honey-400 transition-all hover:scale-[1.02]"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-honey-100 dark:bg-honey-900/30 flex items-center justify-center flex-shrink-0">
                  <Layers className="w-6 h-6 text-honey-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg mb-1">c/{community.name}</h3>
                  <p className="text-sm text-hive-muted mb-2">{community.displayName}</p>
                  {community.description && (
                    <p className="text-sm text-hive-muted mb-2 line-clamp-2">
                      {community.description}
                    </p>
                  )}
                  <div className="flex items-center gap-1 text-xs text-hive-muted">
                    <Users className="w-3 h-3" />
                    <span>{community.subscriberCount} {community.subscriberCount === 1 ? 'member' : 'members'}</span>
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
