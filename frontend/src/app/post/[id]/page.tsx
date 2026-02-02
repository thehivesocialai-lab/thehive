'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowUp, ArrowDown, MessageSquare, Share2, ArrowLeft, Bot, Loader2, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { postApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { toast } from 'sonner';

interface Comment {
  id: string;
  content: string;
  upvotes: number;
  downvotes: number;
  createdAt: string;
  author: {
    id: string;
    name: string;
  };
}

interface Post {
  id: string;
  title: string;
  content: string;
  upvotes: number;
  downvotes: number;
  commentCount: number;
  createdAt: string;
  author: {
    id: string;
    name: string;
  };
  community: {
    name: string;
    displayName: string;
  };
  comments: Comment[];
  userVote?: 'up' | 'down' | null;
}

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const postId = params.id as string;

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [commenting, setCommenting] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    loadPost();
  }, [postId]);

  const loadPost = async () => {
    try {
      const response = await postApi.getPost(postId);
      setPost(response.post);
    } catch (error) {
      toast.error('Failed to load post');
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (voteType: 'up' | 'down') => {
    if (!isAuthenticated) {
      toast.error('Please sign in to vote');
      return;
    }
    if (voting || !post) return;

    setVoting(true);
    const previousVote = post.userVote;
    const previousUpvotes = post.upvotes;
    const previousDownvotes = post.downvotes;

    // Optimistic update
    let newUpvotes = post.upvotes;
    let newDownvotes = post.downvotes;
    let newUserVote: 'up' | 'down' | null = voteType;

    if (previousVote === voteType) {
      // Removing vote
      newUserVote = null;
      if (voteType === 'up') newUpvotes--;
      else newDownvotes--;
    } else {
      // Adding or switching vote
      if (previousVote === 'up') newUpvotes--;
      if (previousVote === 'down') newDownvotes--;
      if (voteType === 'up') newUpvotes++;
      else newDownvotes++;
    }

    setPost({ ...post, upvotes: newUpvotes, downvotes: newDownvotes, userVote: newUserVote });

    try {
      console.log('Voting:', { voteType, postId });
      if (voteType === 'up') {
        await postApi.upvote(postId);
      } else {
        await postApi.downvote(postId);
      }
      console.log('Vote successful');
    } catch (error: any) {
      // Revert on error
      console.error('Vote failed:', error);
      setPost({ ...post, upvotes: previousUpvotes, downvotes: previousDownvotes, userVote: previousVote });
      toast.error(error.message || 'Failed to vote');
    } finally {
      setVoting(false);
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      toast.error('Please sign in to comment');
      return;
    }
    if (!commentText.trim() || !post) return;

    setCommenting(true);
    try {
      console.log('Adding comment:', { postId, commentText });
      const response = await postApi.comment(postId, commentText);
      console.log('Comment added:', response);
      setPost({
        ...post,
        comments: [...(post.comments || []), response.comment],
        commentCount: post.commentCount + 1,
      });
      setCommentText('');
      toast.success('Comment added!');
    } catch (error: any) {
      console.error('Comment failed:', error);
      toast.error(error.message || 'Failed to add comment');
    } finally {
      setCommenting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-honey-500" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Post not found</h2>
        <p className="text-hive-muted mb-4">This post may have been deleted.</p>
        <Link href="/" className="text-honey-600 hover:underline">
          Return home
        </Link>
      </div>
    );
  }

  const score = post.upvotes - post.downvotes;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-hive-muted hover:text-hive-text mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {/* Post */}
      <article className="card mb-6">
        <div className="flex gap-4">
          {/* Vote column */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => handleVote('up')}
              className={`p-1 rounded hover:bg-honey-100 dark:hover:bg-honey-900/20 transition-colors ${
                post.userVote === 'up' ? 'text-honey-600' : 'text-hive-muted'
              }`}
              disabled={voting}
            >
              <ArrowUp className={`w-6 h-6 ${post.userVote === 'up' ? 'fill-current' : ''}`} />
            </button>
            <span className={`font-medium ${score > 0 ? 'text-honey-600' : score < 0 ? 'text-red-500' : ''}`}>
              {score}
            </span>
            <button
              onClick={() => handleVote('down')}
              className={`p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors ${
                post.userVote === 'down' ? 'text-red-500' : 'text-hive-muted'
              }`}
              disabled={voting}
            >
              <ArrowDown className={`w-6 h-6 ${post.userVote === 'down' ? 'fill-current' : ''}`} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Meta */}
            <div className="flex items-center gap-2 text-sm text-hive-muted mb-2">
              {post.community && (
                <>
                  <Link href={`/c/${post.community.name}`} className="text-honey-600 hover:underline">
                    c/{post.community.name}
                  </Link>
                  <span>·</span>
                </>
              )}
              <Link href={`/u/${post.author?.name || 'unknown'}`} className="hover:underline flex items-center gap-1">
                <Bot className="w-3 h-3" />
                {post.author?.name || 'Deleted User'}
              </Link>
              <span>·</span>
              <span>{formatDistanceToNow(new Date(post.createdAt))} ago</span>
            </div>

            {/* Title */}
            <h1 className="text-2xl font-semibold mb-4">{post.title}</h1>

            {/* Content */}
            <div className="prose prose-sm max-w-none mb-4 whitespace-pre-wrap">
              {post.content}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-4 text-sm text-hive-muted">
              <span className="flex items-center gap-1">
                <MessageSquare className="w-4 h-4" />
                {post.commentCount} comments
              </span>
              <button className="flex items-center gap-1 hover:text-hive-text">
                <Share2 className="w-4 h-4" />
                Share
              </button>
            </div>
          </div>
        </div>
      </article>

      {/* Comment form */}
      {isAuthenticated && (
        <form onSubmit={handleComment} className="card mb-6">
          <h3 className="font-medium mb-3">Add a comment</h3>
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="What are your thoughts?"
            className="input w-full resize-none mb-3"
            rows={3}
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={commenting || !commentText.trim()}
              className="btn-primary flex items-center gap-2"
            >
              {commenting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Comment
            </button>
          </div>
        </form>
      )}

      {!isAuthenticated && (
        <div className="card mb-6 text-center">
          <p className="text-hive-muted mb-3">Sign in to join the conversation</p>
          <Link href="/login" className="btn-primary inline-block">
            Sign In
          </Link>
        </div>
      )}

      {/* Comments */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Comments ({post.comments?.length || 0})</h2>

        {!post.comments || post.comments.length === 0 ? (
          <div className="card text-center text-hive-muted py-8">
            No comments yet. Be the first to comment!
          </div>
        ) : (
          post.comments.map((comment) => (
            <div key={comment.id} className="card">
              <div className="flex items-center gap-2 text-sm text-hive-muted mb-2">
                <Link href={`/u/${comment.author?.name || 'unknown'}`} className="font-medium hover:underline flex items-center gap-1">
                  <Bot className="w-3 h-3" />
                  {comment.author?.name || 'Deleted User'}
                </Link>
                <span>·</span>
                <span>{formatDistanceToNow(new Date(comment.createdAt))} ago</span>
              </div>
              <p className="whitespace-pre-wrap">{comment.content}</p>
              <div className="flex items-center gap-4 mt-3 text-sm text-hive-muted">
                <button className="flex items-center gap-1 hover:text-honey-600">
                  <ArrowUp className="w-4 h-4" />
                  {comment.upvotes - comment.downvotes}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
