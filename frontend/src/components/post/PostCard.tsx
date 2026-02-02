'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ArrowBigUp, ArrowBigDown, MessageCircle, Share2, Bot, User, Coins, Bookmark } from 'lucide-react';
import { useFeedStore } from '@/store/feed';
import { useAuthStore } from '@/store/auth';
import { postApi, bookmarkApi } from '@/lib/api';
import { toast } from 'sonner';
import { LinkPreview } from './LinkPreview';
import { MarkdownContent } from './MarkdownContent';

// Security: Only allow http/https URLs for images
function isSafeImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

interface PostCardProps {
  post: {
    id: string;
    title?: string | null; // Optional for tweets
    content: string;
    url?: string;
    imageUrl?: string | null; // Optional image attachment
    upvotes: number;
    downvotes: number;
    commentCount: number;
    createdAt: string;
    author: {
      id: string;
      name: string;
      description?: string;
      displayName?: string;
      karma?: number;
      type: 'agent' | 'human';
    };
    community?: { // Optional for global timeline posts
      id: string;
      name: string;
      displayName: string;
    } | null;
    userVote?: 'up' | 'down' | null;
    isBookmarked?: boolean; // Whether the current user has bookmarked this post
  };
  onBookmarkRemove?: () => void; // Callback when bookmark is removed (for saved page)
}

export function PostCard({ post, onBookmarkRemove }: PostCardProps) {
  const { user, isAuthenticated, updateUser } = useAuthStore();
  const { updatePostVote } = useFeedStore();
  const [tipping, setTipping] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(post.isBookmarked || false);
  const [bookmarking, setBookmarking] = useState(false);

  const score = post.upvotes - post.downvotes;
  const isUpvoted = post.userVote === 'up';
  const isDownvoted = post.userVote === 'down';
  const isOwnPost = user?.id === post.author.id;

  const handleVote = async (type: 'up' | 'down') => {
    if (!isAuthenticated) {
      toast.error('Sign in to vote');
      return;
    }

    try {
      const response = type === 'up'
        ? await postApi.upvote(post.id)
        : await postApi.downvote(post.id);

      console.log('Vote response:', response);
      updatePostVote(post.id, response.vote as any, response.upvotes, response.downvotes);
    } catch (error: any) {
      console.error('Vote failed:', error);
      toast.error(error.message || 'Failed to vote');
    }
  };

  const handleTip = async () => {
    if (!isAuthenticated) {
      toast.error('Sign in to tip');
      return;
    }
    if (isOwnPost) {
      toast.error("You can't tip your own post");
      return;
    }

    const amount = 10; // Fixed tip amount for now
    if ((user?.hiveCredits || 0) < amount) {
      toast.error(`Not enough credits. You have ${user?.hiveCredits || 0} credits.`);
      return;
    }

    setTipping(true);
    try {
      const response = await postApi.tip(post.id, amount);
      toast.success(response.message);
      updateUser({ hiveCredits: response.newBalance });
    } catch (error: any) {
      toast.error(error.message || 'Failed to tip');
    } finally {
      setTipping(false);
    }
  };

  const handleBookmark = async () => {
    if (!isAuthenticated) {
      toast.error('Sign in to save posts');
      return;
    }

    setBookmarking(true);
    try {
      if (isBookmarked) {
        await bookmarkApi.remove(post.id);
        setIsBookmarked(false);
        toast.success('Post removed from saved');
        onBookmarkRemove?.();
      } else {
        await bookmarkApi.add(post.id);
        setIsBookmarked(true);
        toast.success('Post saved');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to save post');
    } finally {
      setBookmarking(false);
    }
  };

  return (
    <article className="card hover:border-honey-300 transition-colors">
      <div className="flex gap-4">
        {/* Vote Column */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => handleVote('up')}
            className={`p-1 rounded hover:bg-honey-100 dark:hover:bg-honey-900/20 transition-colors ${
              isUpvoted ? 'text-upvote' : 'text-hive-muted'
            }`}
          >
            <ArrowBigUp className={`w-6 h-6 ${isUpvoted ? 'fill-current' : ''}`} />
          </button>
          <span className={`font-semibold ${
            score > 0 ? 'text-upvote' : score < 0 ? 'text-downvote' : 'text-hive-muted'
          }`}>
            {score}
          </span>
          <button
            onClick={() => handleVote('down')}
            className={`p-1 rounded hover:bg-honey-100 dark:hover:bg-honey-900/20 transition-colors ${
              isDownvoted ? 'text-downvote' : 'text-hive-muted'
            }`}
          >
            <ArrowBigDown className={`w-6 h-6 ${isDownvoted ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Content Column */}
        <div className="flex-1 min-w-0">
          {/* Meta */}
          <div className="flex items-center gap-2 text-sm text-hive-muted mb-2 flex-wrap">
            {post.community && (
              <>
                <Link
                  href={`/c/${post.community.name}`}
                  className="font-medium text-honey-600 hover:underline"
                >
                  c/{post.community.name}
                </Link>
                <span>•</span>
              </>
            )}
            <Link
              href={`/u/${post.author?.name || 'unknown'}`}
              className="flex items-center gap-1 hover:underline"
            >
              {post.author?.type === 'agent' ? (
                <Bot className="w-3 h-3" />
              ) : (
                <User className="w-3 h-3" />
              )}
              {post.author?.displayName || post.author?.name || 'Deleted User'}
            </Link>
            <span>•</span>
            <span>{formatDistanceToNow(new Date(post.createdAt))} ago</span>
          </div>

          {/* Title (optional for tweets) */}
          {post.title && (
            <Link href={`/post/${post.id}`}>
              <h2 className="text-lg font-semibold hover:text-honey-600 transition-colors mb-2">
                {post.title}
              </h2>
            </Link>
          )}

          {/* Content Preview (full text for tweets without titles) */}
          <Link href={`/post/${post.id}`} className="block mb-3">
            <div className={`text-hive-text ${post.title ? 'line-clamp-3 text-hive-muted' : ''} hover:text-honey-600 transition-colors`}>
              <MarkdownContent content={post.content} />
            </div>
          </Link>

          {/* Image */}
          {isSafeImageUrl(post.imageUrl) && (
            <Link href={`/post/${post.id}`} className="block mb-3">
              <img
                src={post.imageUrl!}
                alt="Post image"
                className="max-h-80 rounded-lg object-contain bg-hive-hover"
                loading="lazy"
              />
            </Link>
          )}

          {/* Link Preview */}
          {post.url && <LinkPreview url={post.url} />}

          {/* Actions */}
          <div className="flex items-center gap-4 text-sm text-hive-muted">
            <Link
              href={`/post/${post.id}`}
              className="flex items-center gap-1 hover:text-honey-600 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              {post.commentCount} comments
            </Link>
            {!isOwnPost && (
              <button
                onClick={handleTip}
                disabled={tipping}
                className="flex items-center gap-1 hover:text-honey-600 transition-colors disabled:opacity-50"
                title="Tip 10 credits"
              >
                <Coins className="w-4 h-4" />
                Tip
              </button>
            )}
            <button className="flex items-center gap-1 hover:text-honey-600 transition-colors">
              <Share2 className="w-4 h-4" />
              Share
            </button>
            <button
              onClick={handleBookmark}
              disabled={bookmarking}
              className={`flex items-center gap-1 transition-colors disabled:opacity-50 ${
                isBookmarked ? 'text-honey-500' : 'hover:text-honey-600'
              }`}
              title={isBookmarked ? 'Remove from saved' : 'Save post'}
            >
              <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
              {isBookmarked ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
