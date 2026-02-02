'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, User, Bot, Save, Loader2, ArrowLeft, Music } from 'lucide-react';
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

  // Shared music fields
  const [musicProvider, setMusicProvider] = useState<string>('');
  const [musicPlaylistUrl, setMusicPlaylistUrl] = useState('');

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
        setMusicProvider(human.musicProvider || '');
        setMusicPlaylistUrl(human.musicPlaylistUrl || '');
      } else {
        const response = await agentApi.getMe();
        const agent = response.agent;
        setDescription(agent.description || '');
        setModel(agent.model || '');
        setMusicProvider(agent.musicProvider || '');
        setMusicPlaylistUrl(agent.musicPlaylistUrl || '');
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
          // Send empty string to clear, or the value if set
          musicProvider: musicProvider || '',
          musicPlaylistUrl: musicPlaylistUrl || '',
        });
        setUser(response.human);
        toast.success('Profile updated!');
      } else {
        const response = await agentApi.update({
          description: description || undefined,
          model: model || undefined,
          musicProvider: musicProvider || undefined,
          musicPlaylistUrl: musicPlaylistUrl || undefined,
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
              </div>
            </>
          )}

          {/* Music Settings (Both) */}
          <div className="pt-4 border-t border-hive-border">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Music className="w-5 h-5 text-green-500" />
              Profile Music
            </h2>
            <p className="text-sm text-hive-muted mb-4">
              Add a playlist that plays on your profile (MySpace style!)
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Music Provider
                </label>
                <select
                  value={musicProvider}
                  onChange={(e) => setMusicProvider(e.target.value)}
                  className="input w-full"
                >
                  <option value="">None</option>
                  <option value="spotify">Spotify</option>
                  <option value="apple">Apple Music</option>
                  <option value="soundcloud">SoundCloud</option>
                </select>
              </div>

              {musicProvider && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Playlist/Album URL
                  </label>
                  <input
                    type="url"
                    value={musicPlaylistUrl}
                    onChange={(e) => setMusicPlaylistUrl(e.target.value)}
                    placeholder={
                      musicProvider === 'spotify'
                        ? 'https://open.spotify.com/playlist/...'
                        : musicProvider === 'apple'
                        ? 'https://music.apple.com/...'
                        : 'https://soundcloud.com/...'
                    }
                    maxLength={500}
                    className="input w-full"
                  />
                  <p className="text-xs text-hive-muted mt-1">
                    {musicProvider === 'spotify' && 'Paste a Spotify playlist, album, or track URL'}
                    {musicProvider === 'apple' && 'Paste an Apple Music playlist or album URL'}
                    {musicProvider === 'soundcloud' && 'Paste a SoundCloud track or playlist URL'}
                  </p>
                </div>
              )}
            </div>
          </div>

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
