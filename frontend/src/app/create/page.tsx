'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Send, Loader2, ArrowLeft } from 'lucide-react';
import { postApi, communityApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { toast } from 'sonner';

interface Community {
  name: string;
  displayName: string;
  description: string;
}

export default function CreatePostPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  const [mode, setMode] = useState<'tweet' | 'post'>('tweet'); // NEW: tweet vs post mode
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [community, setCommunity] = useState('');
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCommunities, setLoadingCommunities] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      toast.error('Please sign in to create a post');
      router.push('/login');
      return;
    }
    loadCommunities();
  }, [isAuthenticated, router]);

  const loadCommunities = async () => {
    try {
      const response = await communityApi.list();
      setCommunities(response.communities);
    } catch (error) {
      console.error('Failed to load communities');
    } finally {
      setLoadingCommunities(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      toast.error('Content is required');
      return;
    }

    if (mode === 'post' && !title.trim()) {
      toast.error('Title is required for full posts');
      return;
    }

    setLoading(true);
    try {
      const response = await postApi.create({
        content: content.trim(),
        ...(mode === 'post' && title.trim() && { title: title.trim() }),
        ...(community && { community }),
      });

      toast.success(response.message || 'Posted!');
      router.push(`/post/${response.post.id}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-hive-muted hover:text-hive-text"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <h1 className="text-2xl font-bold">Create Post</h1>
      </div>

      {/* Mode Toggle */}
      <div className="card mb-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('tweet')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              mode === 'tweet'
                ? 'bg-honey-500 text-white'
                : 'hover:bg-honey-100 dark:hover:bg-honey-900/20'
            }`}
          >
            📝 Quick Tweet
          </button>
          <button
            type="button"
            onClick={() => setMode('post')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              mode === 'post'
                ? 'bg-honey-500 text-white'
                : 'hover:bg-honey-100 dark:hover:bg-honey-900/20'
            }`}
          >
            📄 Full Post
          </button>
        </div>
        <p className="text-sm text-hive-muted mt-2">
          {mode === 'tweet'
            ? 'Quick tweet to global timeline (no title needed)'
            : 'Full post with title (optional community)'}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="card">
        {/* Community select (only for full posts) */}
        {mode === 'post' && (
          <div className="mb-4">
            <label htmlFor="community" className="block text-sm font-medium mb-2">
              Community (optional)
            </label>
            {loadingCommunities ? (
              <div className="input w-full flex items-center">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            ) : (
              <select
                id="community"
                value={community}
                onChange={(e) => setCommunity(e.target.value)}
                className="input w-full"
              >
                <option value="">Global Timeline</option>
                {communities.map((c) => (
                  <option key={c.name} value={c.name}>
                    c/{c.name} - {c.displayName}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Title (only for full posts) */}
        {mode === 'post' && (
          <div className="mb-4">
            <label htmlFor="title" className="block text-sm font-medium mb-2">
              Title *
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="An interesting title"
              className="input w-full"
              maxLength={300}
            />
            <p className="text-xs text-hive-muted mt-1">
              {title.length}/300 characters
            </p>
          </div>
        )}

        {/* Content */}
        <div className="mb-6">
          <label htmlFor="content" className="block text-sm font-medium mb-2">
            Content *
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share your thoughts, discoveries, or questions..."
            className="input w-full resize-none"
            rows={8}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-hive-muted">
            Posting as <span className="font-medium text-honey-600">{user?.name}</span>
          </p>
          <div className="flex gap-3">
            <Link href="/" className="btn-secondary">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading || !title.trim() || !content.trim()}
              className="btn-primary flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Post
            </button>
          </div>
        </div>
      </form>

      {/* Tips */}
      <div className="mt-6 p-4 bg-honey-50 dark:bg-honey-900/10 rounded-lg">
        <h3 className="font-medium text-honey-800 dark:text-honey-200 mb-2">Tips for a great post</h3>
        <ul className="text-sm text-honey-700 dark:text-honey-300 space-y-1">
          <li>• Use a clear, descriptive title</li>
          <li>• Add context about what you&apos;re sharing or asking</li>
          <li>• Choose the right community for your content</li>
          <li>• Be respectful and constructive</li>
        </ul>
      </div>
    </div>
  );
}
