'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Bot, User, MessageCircle, Loader2, FileText } from 'lucide-react';
import { teamApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { toast } from 'sonner';
import { MarkdownContent } from '@/components/post/MarkdownContent';

const TAG_COLORS = {
  people: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  timeline: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  organizations: 'bg-green-500/20 text-green-400 border-green-500/30',
  locations: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  findings: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
} as const;

type TagType = keyof typeof TAG_COLORS;

const TAG_OPTIONS: { value: TagType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'people', label: 'People' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'organizations', label: 'Organizations' },
  { value: 'locations', label: 'Locations' },
  { value: 'findings', label: 'Findings' },
];

interface Finding {
  id: string;
  content: string;
  tags: string[];
  documentRef?: string | null;
  parentId?: string | null;
  createdAt: string;
  author: {
    id: string;
    name?: string;
    username?: string;
    displayName?: string;
    type: 'agent' | 'human';
  };
  replies: Finding[];
}

interface TeamFeedProps {
  teamId: string;
  isMember: boolean;
}

export function TeamFeed({ teamId, isMember }: TeamFeedProps) {
  const { isAuthenticated } = useAuthStore();
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [selectedTags, setSelectedTags] = useState<TagType[]>([]);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    loadFindings(true);
  }, [teamId, selectedTags]);

  async function loadFindings(reset = false) {
    try {
      if (reset) {
        setLoading(true);
        setCursor(undefined);
        setFindings([]);
      } else {
        setLoadingMore(true);
      }

      const tags = selectedTags.length > 0 ? selectedTags : undefined;
      const response = await teamApi.getFindings(teamId, reset ? undefined : cursor, tags);

      if (reset) {
        setFindings(response.findings || []);
      } else {
        setFindings([...findings, ...(response.findings || [])]);
      }

      setCursor(response.pagination?.nextCursor);
      setHasMore(!!response.pagination?.hasMore);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load feed');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  function toggleTag(tag: TagType | 'all') {
    if (tag === 'all') {
      setSelectedTags([]);
    } else {
      setSelectedTags((prev) =>
        prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
      );
    }
  }

  async function handleReply(parentId: string) {
    if (!replyContent.trim()) return;

    setPosting(true);
    try {
      const response = await teamApi.postFinding(teamId, {
        content: replyContent.trim(),
        tags: [],
        parentId,
      });

      // Add the new reply to the findings list
      setFindings((prev) =>
        prev.map((finding) => {
          if (finding.id === parentId) {
            return {
              ...finding,
              replies: [...finding.replies, response.finding],
            };
          }
          return finding;
        })
      );

      setReplyContent('');
      setReplyingTo(null);
      toast.success('Reply posted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to post reply');
    } finally {
      setPosting(false);
    }
  }

  function renderFinding(finding: Finding, isReply = false) {
    const authorName =
      finding.author.name || finding.author.username || finding.author.displayName || 'Unknown';
    const isAgent = finding.author.type === 'agent';
    const isReplying = replyingTo === finding.id;

    return (
      <div key={finding.id} className={isReply ? 'ml-8 mt-3' : ''}>
        <div className="bg-hive-bg-secondary rounded-lg p-4">
          {/* Author & timestamp */}
          <div className="flex items-center gap-2 mb-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                isAgent ? 'bg-purple-500/20' : 'bg-blue-500/20'
              }`}
            >
              {isAgent ? (
                <Bot className="w-4 h-4 text-purple-400" />
              ) : (
                <User className="w-4 h-4 text-blue-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-medium">{authorName}</span>
              <span className="text-hive-muted text-sm ml-2">
                {formatDistanceToNow(new Date(finding.createdAt), { addSuffix: true })}
              </span>
            </div>
          </div>

          {/* Tags */}
          {finding.tags && finding.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {finding.tags.map((tag) => (
                <span
                  key={tag}
                  className={`px-2 py-0.5 rounded-full text-xs border ${
                    TAG_COLORS[tag.toLowerCase() as TagType] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Content */}
          <MarkdownContent content={finding.content} className="text-hive-text" />

          {/* Document reference */}
          {finding.documentRef && (
            <a
              href={finding.documentRef}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-sm text-honey-500 hover:text-honey-400"
            >
              <FileText className="w-4 h-4" />
              View document
            </a>
          )}

          {/* Reply button */}
          {isMember && isAuthenticated && !isReply && (
            <button
              onClick={() => setReplyingTo(isReplying ? null : finding.id)}
              className="mt-3 flex items-center gap-1 text-sm text-hive-muted hover:text-honey-500 transition"
            >
              <MessageCircle className="w-4 h-4" />
              Reply {finding.replies?.length > 0 && `(${finding.replies.length})`}
            </button>
          )}

          {/* Reply form */}
          {isReplying && (
            <div className="mt-3 space-y-2">
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Write a reply..."
                rows={3}
                className="input w-full resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleReply(finding.id)}
                  disabled={posting || !replyContent.trim()}
                  className="btn-primary text-sm"
                >
                  {posting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                      Posting...
                    </>
                  ) : (
                    'Post Reply'
                  )}
                </button>
                <button onClick={() => setReplyingTo(null)} className="btn-secondary text-sm">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Threaded replies */}
        {finding.replies?.length > 0 && (
          <div className="space-y-3 mt-3">
            {finding.replies.map((reply) => renderFinding(reply, true))}
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-honey-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tag filter buttons */}
      <div className="flex flex-wrap gap-2">
        {TAG_OPTIONS.map((option) => {
          const isSelected = option.value === 'all' ? selectedTags.length === 0 : selectedTags.includes(option.value as TagType);
          return (
            <button
              key={option.value}
              onClick={() => toggleTag(option.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                isSelected
                  ? 'bg-honey-500 text-black'
                  : 'bg-hive-bg-secondary text-hive-muted hover:text-white hover:bg-hive-border'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {/* Findings list */}
      {findings.length === 0 ? (
        <div className="card text-center py-12 text-hive-muted">
          <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No findings yet</p>
          {isMember && <p className="text-sm mt-1">Be the first to post</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {findings.map((finding) => renderFinding(finding))}
        </div>
      )}

      {/* Load more button */}
      {hasMore && findings.length > 0 && (
        <button
          onClick={() => loadFindings(false)}
          disabled={loadingMore}
          className="w-full py-3 text-sm text-honey-500 hover:text-honey-400 transition flex items-center justify-center gap-2"
        >
          {loadingMore ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </>
          ) : (
            'Load more'
          )}
        </button>
      )}
    </div>
  );
}
