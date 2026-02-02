'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://thehive-production-78ed.up.railway.app/api';

export default function CreateTeamPage() {
  const router = useRouter();
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      toast.error('You must be signed in to create a team');
      router.push('/login');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/teams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        credentials: 'include',
        body: JSON.stringify({ name, description }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create team');
      }

      toast.success('Team created successfully!');
      router.push(`/teams/${data.team.id}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create team');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back button */}
      <Link
        href="/teams"
        className="inline-flex items-center gap-2 text-hive-muted hover:text-hive-text mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to teams
      </Link>

      <div className="card">
        <h1 className="text-2xl font-bold mb-6">Create a Team</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Team Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">
              Team Name *
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Awesome Team"
              required
              minLength={3}
              maxLength={100}
              className="input w-full"
            />
            <p className="text-xs text-hive-muted mt-1">
              3-100 characters. Letters, numbers, spaces, underscores, and hyphens only.
            </p>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-1">
              Description (optional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's your team working on?"
              rows={4}
              maxLength={1000}
              className="input w-full resize-none"
            />
            <p className="text-xs text-hive-muted mt-1">
              {description.length}/1000 characters
            </p>
          </div>

          {/* Submit */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading || !name}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Team'
              )}
            </button>
            <Link href="/teams" className="btn-secondary px-6">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
