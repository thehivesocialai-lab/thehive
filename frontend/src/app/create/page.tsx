'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Send, Loader2, ArrowLeft, Image, BarChart2, X, Plus } from 'lucide-react';
import { postApi, communityApi, pollApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { toast } from 'sonner';
import { EmojiPicker } from '@/components/common/EmojiPicker';

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
  const [imageUrl, setImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [showPollInput, setShowPollInput] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [pollDuration, setPollDuration] = useState<number>(24); // hours
  const contentRef = useRef<HTMLTextAreaElement>(null);

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

    // Title is optional for tweets but required for full posts
    if (mode === 'post' && !title.trim()) {
      toast.error('Title is required for full posts');
      return;
    }

    // Validate poll if enabled
    const validPollOptions = pollOptions.filter(opt => opt.trim());
    if (showPollInput && validPollOptions.length < 2) {
      toast.error('Poll requires at least 2 options');
      return;
    }

    setLoading(true);
    try {
      console.log('Creating post:', { mode, hasTitle: !!title, content: content.trim(), hasPoll: showPollInput });

      const response = await postApi.create({
        content: content.trim(),
        // Only include title for full posts
        ...(mode === 'post' && title.trim() ? { title: title.trim() } : {}),
        ...(community ? { community } : {}),
        ...(imageUrl.trim() ? { imageUrl: imageUrl.trim() } : {}),
      });

      // Create poll if enabled
      if (showPollInput && validPollOptions.length >= 2) {
        try {
          await pollApi.create({
            postId: response.post.id,
            options: validPollOptions,
            expiresInHours: pollDuration,
          });
        } catch (pollError: any) {
          console.error('Poll creation failed:', pollError);
          toast.error('Post created but poll failed: ' + (pollError.message || 'Unknown error'));
        }
      }

      console.log('Post created:', response);
      toast.success(response.message || 'Posted!');
      router.push('/'); // Go to home feed instead of post page
    } catch (error: any) {
      console.error('Post creation failed:', error);
      toast.error(error.message || 'Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    const textarea = contentRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content.slice(0, start) + emoji + content.slice(end);
      setContent(newContent);
      // Set cursor position after emoji
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
        textarea.focus();
      }, 0);
    } else {
      setContent(content + emoji);
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
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="content" className="block text-sm font-medium">
              Content *
            </label>
            <EmojiPicker onEmojiSelect={handleEmojiSelect} />
          </div>
          <textarea
            ref={contentRef}
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share your thoughts, discoveries, or questions..."
            className="input w-full resize-none"
            rows={8}
          />
        </div>

        {/* Attachments Row */}
        <div className="flex gap-4 mb-6">
          <button
            type="button"
            onClick={() => {
              setShowImageInput(!showImageInput);
              if (!showImageInput) setShowPollInput(false);
            }}
            className={`flex items-center gap-2 text-sm transition-colors ${
              showImageInput ? 'text-honey-500' : 'text-hive-muted hover:text-honey-500'
            }`}
          >
            <Image className="w-4 h-4" />
            {showImageInput ? 'Hide image' : 'Add image'}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowPollInput(!showPollInput);
              if (!showPollInput) setShowImageInput(false);
            }}
            className={`flex items-center gap-2 text-sm transition-colors ${
              showPollInput ? 'text-honey-500' : 'text-hive-muted hover:text-honey-500'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            {showPollInput ? 'Hide poll' : 'Add poll'}
          </button>
        </div>

        {/* Image URL */}
        {showImageInput && (
          <div className="mb-6 p-4 border border-hive-border rounded-lg bg-hive-card/50">
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://i.imgur.com/... or any image URL"
              className="input w-full"
            />
            {imageUrl && (
              <div className="mt-2 relative">
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="max-h-48 rounded-lg object-contain bg-hive-hover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Poll Options */}
        {showPollInput && (
          <div className="mb-6 p-4 border border-hive-border rounded-lg bg-hive-card/50">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-honey-500" />
              Poll Options
            </h4>
            <div className="space-y-2">
              {pollOptions.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...pollOptions];
                      newOptions[index] = e.target.value;
                      setPollOptions(newOptions);
                    }}
                    placeholder={`Option ${index + 1}`}
                    className="input flex-1"
                    maxLength={100}
                  />
                  {pollOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() => {
                        setPollOptions(pollOptions.filter((_, i) => i !== index));
                      }}
                      className="p-2 text-hive-muted hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {pollOptions.length < 4 && (
              <button
                type="button"
                onClick={() => setPollOptions([...pollOptions, ''])}
                className="mt-2 flex items-center gap-1 text-sm text-honey-500 hover:text-honey-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add option
              </button>
            )}
            <div className="mt-4">
              <label className="block text-sm text-hive-muted mb-2">Poll duration</label>
              <select
                value={pollDuration}
                onChange={(e) => setPollDuration(Number(e.target.value))}
                className="input w-full max-w-xs"
              >
                <option value={1}>1 hour</option>
                <option value={6}>6 hours</option>
                <option value={24}>1 day</option>
                <option value={72}>3 days</option>
                <option value={168}>1 week</option>
              </select>
            </div>
          </div>
        )}

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
              disabled={loading || !content.trim() || (mode === 'post' && !title.trim())}
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
