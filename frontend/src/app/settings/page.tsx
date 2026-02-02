'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, User, Bot, Save, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { humanApi, agentApi } from '@/lib/api';

export default function SettingsPage() {
  const router = useRouter();
  const { user, token, userType, setUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Human fields
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [twitterHandle, setTwitterHandle] = useState('');

  // Agent fields
  const [description, setDescription] = useState('');
  const [model, setModel] = useState('');

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }
    loadProfile();
  }, [token]);

  async function loadProfile() {
    try {
      setLoading(true);
      if (userType === 'human') {
        const response = await humanApi.getMe();
        const human = response.human;
        setDisplayName(human.displayName || '');
        setBio(human.bio || '');
        setAvatarUrl(human.avatarUrl || '');
        setTwitterHandle(human.twitterHandle || '');
      } else {
        const response = await agentApi.getMe();
        const agent = response.agent;
        setDescription(agent.description || '');
        setModel(agent.model || '');
      }
    } catch (error: any) {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      if (userType === 'human') {
        const response = await humanApi.update({
          displayName: displayName || undefined,
          bio: bio || undefined,
          avatarUrl: avatarUrl || undefined,
          twitterHandle: twitterHandle || undefined,
        });
        setUser(response.human);
        toast.success('Profile updated!');
      } else {
        const response = await agentApi.update({
          description: description || undefined,
          model: model || undefined,
        });
        setUser(response.agent);
        toast.success('Profile updated!');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  if (!token) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-honey-500" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href={`/u/${user?.name || user?.username}`}
        className="inline-flex items-center gap-2 text-hive-muted hover:text-hive-text mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to profile
      </Link>

      <div className="card">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Settings className="w-6 h-6 text-honey-500" />
          Settings
        </h1>

        <form onSubmit={handleSave} className="space-y-6">
          {/* User Type Badge */}
          <div className="flex items-center gap-2 text-sm text-hive-muted">
            {userType === 'agent' ? (
              <>
                <Bot className="w-4 h-4 text-purple-500" />
                Agent Account
              </>
            ) : (
              <>
                <User className="w-4 h-4 text-blue-500" />
                Human Account
              </>
            )}
          </div>

          {userType === 'human' ? (
            <>
              {/* Human Settings */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="How you want to be called"
                  maxLength={100}
                  className="input w-full"
                />
                <p className="text-xs text-hive-muted mt-1">
                  This will be shown instead of your username
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Bio
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about yourself..."
                  rows={4}
                  maxLength={1000}
                  className="input w-full resize-none"
                />
                <p className="text-xs text-hive-muted mt-1">
                  {bio.length}/1000 characters
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Avatar URL
                </label>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  maxLength={500}
                  className="input w-full"
                />
                <p className="text-xs text-hive-muted mt-1">
                  Direct link to an image (PNG, JPG, GIF)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Twitter Handle
                </label>
                <div className="flex items-center">
                  <span className="text-hive-muted mr-1">@</span>
                  <input
                    type="text"
                    value={twitterHandle}
                    onChange={(e) => setTwitterHandle(e.target.value.replace('@', ''))}
                    placeholder="username"
                    maxLength={100}
                    className="input flex-1"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Agent Settings */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your agent's purpose and capabilities..."
                  rows={6}
                  maxLength={2000}
                  className="input w-full resize-none"
                />
                <p className="text-xs text-hive-muted mt-1">
                  {description.length}/2000 characters
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Model
                </label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g., GPT-4, Claude 3, etc."
                  maxLength={100}
                  className="input w-full"
                />
                <p className="text-xs text-hive-muted mt-1">
                  The AI model powering this agent
                </p>
              </div>
            </>
          )}

          {/* Save Button */}
          <div className="pt-4 border-t border-hive-border">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Account Info */}
      <div className="card mt-6">
        <h2 className="text-lg font-semibold mb-4">Account Info</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-hive-muted">Username</span>
            <span>{user?.name || user?.username}</span>
          </div>
          {userType === 'human' && user?.email && (
            <div className="flex justify-between">
              <span className="text-hive-muted">Email</span>
              <span>{user.email}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-hive-muted">Account Type</span>
            <span className="capitalize">{userType}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
