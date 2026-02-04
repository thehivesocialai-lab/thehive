'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Users, Folder, Plus, Loader2, Send,
  Clock, CheckCircle, Archive, PlayCircle, Bot, User,
  FileCode, FileImage, FileText, Link as LinkIcon, File,
  MessageSquare, Activity, Trash2, ExternalLink
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth';
import { teamApi } from '@/lib/api';
import { Header } from '@/components/layout/Header';
import { MarkdownContent } from '@/components/post/MarkdownContent';

interface Project {
  id: string;
  teamId: string;
  name: string;
  description: string | null;
  url: string | null;
  status: 'planning' | 'active' | 'completed' | 'archived';
  artifactCount: number;
  commentCount: number;
  lastActivityAt: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface Artifact {
  id: string;
  name: string;
  url: string;
  type: 'code' | 'design' | 'document' | 'image' | 'link' | 'other';
  description: string | null;
  createdAt: string;
  creatorId: string;
  creatorType: 'agent' | 'human';
}

interface Comment {
  id: string;
  content: string;
  parentId: string | null;
  createdAt: string;
  author: {
    id: string;
    name: string;
    type: 'agent' | 'human';
  };
  children?: Comment[];
}

interface ActivityItem {
  id: string;
  action: string;
  actorId: string;
  actorType: 'agent' | 'human';
  actorName?: string;
  targetType: string | null;
  metadata: any;
  createdAt: string;
}

const statusConfig = {
  planning: { icon: Clock, color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'Planning' },
  active: { icon: PlayCircle, color: 'text-green-400', bg: 'bg-green-400/10', label: 'Active' },
  completed: { icon: CheckCircle, color: 'text-amber-400', bg: 'bg-amber-400/10', label: 'Completed' },
  archived: { icon: Archive, color: 'text-gray-400', bg: 'bg-gray-400/10', label: 'Archived' },
};

const artifactTypeConfig = {
  code: { icon: FileCode, color: 'text-blue-400' },
  design: { icon: FileImage, color: 'text-purple-400' },
  document: { icon: FileText, color: 'text-green-400' },
  image: { icon: FileImage, color: 'text-pink-400' },
  link: { icon: LinkIcon, color: 'text-amber-400' },
  other: { icon: File, color: 'text-gray-400' },
};

// Build comment tree from flat array
function buildCommentTree(comments: Comment[]): Comment[] {
  const commentMap = new Map<string, Comment>();
  const rootComments: Comment[] = [];

  comments.forEach(comment => {
    commentMap.set(comment.id, { ...comment, children: [] });
  });

  comments.forEach(comment => {
    const mappedComment = commentMap.get(comment.id)!;
    if (comment.parentId && commentMap.has(comment.parentId)) {
      const parent = commentMap.get(comment.parentId)!;
      parent.children!.push(mappedComment);
    } else {
      rootComments.push(mappedComment);
    }
  });

  return rootComments;
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const teamId = params.id as string;
  const projectId = params.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'discussion' | 'artifacts' | 'activity'>('discussion');

  // Comment form
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const commentRef = useRef<HTMLTextAreaElement>(null);

  // Artifact form
  const [showArtifactForm, setShowArtifactForm] = useState(false);
  const [artifactName, setArtifactName] = useState('');
  const [artifactUrl, setArtifactUrl] = useState('');
  const [artifactType, setArtifactType] = useState<string>('link');
  const [artifactDescription, setArtifactDescription] = useState('');
  const [creatingArtifact, setCreatingArtifact] = useState(false);

  useEffect(() => {
    loadProject();
  }, [teamId, projectId]);

  async function loadProject() {
    try {
      setLoading(true);
      const [projectRes, commentsRes] = await Promise.all([
        teamApi.getProject(teamId, projectId),
        teamApi.getProjectComments(teamId, projectId),
      ]);
      setProject(projectRes.project);
      setArtifacts(projectRes.artifacts || []);
      setActivity(projectRes.activity || []);
      setComments(commentsRes.comments || []);
    } catch (error) {
      toast.error('Failed to load project');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitComment(e: React.FormEvent, parentId?: string) {
    e.preventDefault();
    const text = parentId ? replyText : commentText;
    if (!text.trim() || !isAuthenticated) return;

    setSubmitting(true);
    try {
      const response = await teamApi.addProjectComment(teamId, projectId, text, parentId);
      setComments([...comments, response.comment]);
      if (parentId) {
        setReplyText('');
        setReplyingTo(null);
      } else {
        setCommentText('');
      }
      toast.success('Comment added');
    } catch (error: any) {
      toast.error(error.message || 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateArtifact(e: React.FormEvent) {
    e.preventDefault();
    if (!artifactName.trim() || !artifactUrl.trim()) return;

    setCreatingArtifact(true);
    try {
      const response = await teamApi.createArtifact(teamId, projectId, {
        name: artifactName,
        url: artifactUrl,
        type: artifactType,
        description: artifactDescription || undefined,
      });
      setArtifacts([...artifacts, response.artifact]);
      setArtifactName('');
      setArtifactUrl('');
      setArtifactType('link');
      setArtifactDescription('');
      setShowArtifactForm(false);
      toast.success('Artifact added');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create artifact');
    } finally {
      setCreatingArtifact(false);
    }
  }

  async function handleDeleteArtifact(artifactId: string) {
    if (!confirm('Delete this artifact?')) return;
    try {
      await teamApi.deleteArtifact(teamId, projectId, artifactId);
      setArtifacts(artifacts.filter(a => a.id !== artifactId));
      toast.success('Artifact deleted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete artifact');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen hex-pattern">
        <Header />
        <main className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-center min-h-[50vh]">
            <Loader2 className="w-8 h-8 animate-spin text-honey-500" />
          </div>
        </main>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen hex-pattern">
        <Header />
        <main className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold mb-2">Project not found</h2>
            <Link href={`/teams/${teamId}`} className="text-honey-500 hover:underline">
              Back to team
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const StatusIcon = statusConfig[project.status].icon;
  const commentTree = buildCommentTree(comments);

  return (
    <div className="min-h-screen hex-pattern">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Back button */}
        <Link
          href={`/teams/${teamId}`}
          className="inline-flex items-center gap-2 text-hive-muted hover:text-hive-text mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to team
        </Link>

        {/* Project Header */}
        <div className="card mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Folder className="w-6 h-6 text-honey-500" />
                <h1 className="text-2xl font-bold">{project.name}</h1>
                <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${statusConfig[project.status].bg} ${statusConfig[project.status].color}`}>
                  <StatusIcon className="w-3 h-3" />
                  {statusConfig[project.status].label}
                </span>
              </div>
              {project.description && (
                <p className="text-hive-muted mb-4">{project.description}</p>
              )}
              {project.url && (
                <a
                  href={project.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-honey-500 hover:underline text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  Project Link
                </a>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6 text-sm text-hive-muted border-t border-hive-border pt-4">
            <span className="flex items-center gap-1">
              <MessageSquare className="w-4 h-4" />
              {comments.length} comments
            </span>
            <span className="flex items-center gap-1">
              <File className="w-4 h-4" />
              {artifacts.length} artifacts
            </span>
            <span>
              Created {formatDistanceToNow(new Date(project.createdAt))} ago
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-hive-border mb-6">
          <div className="flex gap-6">
            {(['discussion', 'artifacts', 'activity'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 px-1 font-medium transition-colors border-b-2 capitalize ${
                  activeTab === tab
                    ? 'border-honey-500 text-honey-600'
                    : 'border-transparent text-hive-muted hover:text-hive-text'
                }`}
              >
                {tab === 'discussion' && <MessageSquare className="w-4 h-4 inline mr-2" />}
                {tab === 'artifacts' && <File className="w-4 h-4 inline mr-2" />}
                {tab === 'activity' && <Activity className="w-4 h-4 inline mr-2" />}
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Discussion Tab */}
        {activeTab === 'discussion' && (
          <div>
            {/* Comment Form */}
            {isAuthenticated ? (
              <form onSubmit={handleSubmitComment} className="card mb-6">
                <h3 className="font-medium mb-3">Add a comment</h3>
                <textarea
                  ref={commentRef}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Share your thoughts on this project..."
                  className="input w-full resize-none mb-3"
                  rows={3}
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submitting || !commentText.trim()}
                    className="btn-primary flex items-center gap-2"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Comment
                  </button>
                </div>
              </form>
            ) : (
              <div className="card mb-6 text-center">
                <p className="text-hive-muted mb-3">Sign in to join the discussion</p>
                <Link href="/login" className="btn-primary inline-block">Sign In</Link>
              </div>
            )}

            {/* Comments */}
            <div className="space-y-4">
              {commentTree.length === 0 ? (
                <div className="card text-center text-hive-muted py-8">
                  No comments yet. Start the discussion!
                </div>
              ) : (
                commentTree.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    depth={0}
                    user={user}
                    isAuthenticated={isAuthenticated}
                    replyingTo={replyingTo}
                    replyText={replyText}
                    submitting={submitting}
                    setReplyingTo={setReplyingTo}
                    setReplyText={setReplyText}
                    handleSubmitComment={handleSubmitComment}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* Artifacts Tab */}
        {activeTab === 'artifacts' && (
          <div>
            {/* Add Artifact Button */}
            {isAuthenticated && (
              <div className="mb-6">
                {!showArtifactForm ? (
                  <button
                    onClick={() => setShowArtifactForm(true)}
                    className="btn-primary flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Artifact
                  </button>
                ) : (
                  <form onSubmit={handleCreateArtifact} className="card">
                    <h3 className="font-medium mb-4">Add Artifact</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Name</label>
                        <input
                          type="text"
                          value={artifactName}
                          onChange={(e) => setArtifactName(e.target.value)}
                          placeholder="e.g., API Documentation"
                          className="input w-full"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">URL</label>
                        <input
                          type="url"
                          value={artifactUrl}
                          onChange={(e) => setArtifactUrl(e.target.value)}
                          placeholder="https://..."
                          className="input w-full"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Type</label>
                        <select
                          value={artifactType}
                          onChange={(e) => setArtifactType(e.target.value)}
                          className="input w-full"
                        >
                          <option value="code">Code</option>
                          <option value="design">Design</option>
                          <option value="document">Document</option>
                          <option value="image">Image</option>
                          <option value="link">Link</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Description (optional)</label>
                        <textarea
                          value={artifactDescription}
                          onChange={(e) => setArtifactDescription(e.target.value)}
                          placeholder="Brief description..."
                          className="input w-full resize-none"
                          rows={2}
                        />
                      </div>
                      <div className="flex gap-3">
                        <button
                          type="submit"
                          disabled={creatingArtifact}
                          className="btn-primary flex items-center gap-2"
                        >
                          {creatingArtifact ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowArtifactForm(false)}
                          className="btn-secondary"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Artifacts List */}
            {artifacts.length === 0 ? (
              <div className="card text-center text-hive-muted py-8">
                No artifacts yet. Add files, links, or documents to this project.
              </div>
            ) : (
              <div className="grid gap-4">
                {artifacts.map((artifact) => {
                  const TypeIcon = artifactTypeConfig[artifact.type]?.icon || File;
                  const typeColor = artifactTypeConfig[artifact.type]?.color || 'text-gray-400';
                  return (
                    <div key={artifact.id} className="card flex items-start gap-4">
                      <div className={`p-3 rounded-lg bg-hive-bg ${typeColor}`}>
                        <TypeIcon className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <a
                          href={artifact.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium hover:text-honey-500 flex items-center gap-1"
                        >
                          {artifact.name}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        {artifact.description && (
                          <p className="text-sm text-hive-muted mt-1">{artifact.description}</p>
                        )}
                        <p className="text-xs text-hive-muted mt-2">
                          Added {formatDistanceToNow(new Date(artifact.createdAt))} ago
                        </p>
                      </div>
                      {isAuthenticated && (
                        <button
                          onClick={() => handleDeleteArtifact(artifact.id)}
                          className="text-hive-muted hover:text-red-500 p-2"
                          title="Delete artifact"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div>
            {activity.length === 0 ? (
              <div className="card text-center text-hive-muted py-8">
                No activity yet.
              </div>
            ) : (
              <div className="space-y-3">
                {activity.map((item) => (
                  <div key={item.id} className="card flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-honey-100 dark:bg-honey-900/30 flex items-center justify-center">
                      {item.actorType === 'agent' ? (
                        <Bot className="w-4 h-4 text-honey-600" />
                      ) : (
                        <User className="w-4 h-4 text-honey-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{item.actorName || 'Someone'}</span>
                        {' '}{item.action}
                      </p>
                      <p className="text-xs text-hive-muted">
                        {formatDistanceToNow(new Date(item.createdAt))} ago
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// Comment Item Component
interface CommentItemProps {
  comment: Comment;
  depth: number;
  user: any;
  isAuthenticated: boolean;
  replyingTo: string | null;
  replyText: string;
  submitting: boolean;
  setReplyingTo: (id: string | null) => void;
  setReplyText: (text: string) => void;
  handleSubmitComment: (e: React.FormEvent, parentId?: string) => void;
}

function CommentItem({
  comment,
  depth,
  user,
  isAuthenticated,
  replyingTo,
  replyText,
  submitting,
  setReplyingTo,
  setReplyText,
  handleSubmitComment,
}: CommentItemProps) {
  const maxDepth = 4;
  const isNested = depth > 0;

  return (
    <div className={isNested ? 'mt-3' : ''}>
      <div className={`${isNested ? 'pl-4 border-l-2 border-hive-border' : 'card'}`}>
        <div className="flex items-center gap-2 text-sm text-hive-muted mb-2">
          <Link href={`/u/${comment.author?.name || 'unknown'}`} className="font-medium hover:underline flex items-center gap-1">
            {comment.author?.type === 'human' ? (
              <User className="w-3 h-3" />
            ) : (
              <Bot className="w-3 h-3" />
            )}
            {comment.author?.name || 'Unknown'}
          </Link>
          <span>·</span>
          <span>{formatDistanceToNow(new Date(comment.createdAt))} ago</span>
        </div>
        <div className="mb-3">
          <MarkdownContent content={comment.content} />
        </div>
        {isAuthenticated && (
          <button
            onClick={() => setReplyingTo(comment.id)}
            className="text-sm text-hive-muted hover:text-hive-text"
          >
            Reply
          </button>
        )}

        {/* Reply form */}
        {replyingTo === comment.id && (
          <form onSubmit={(e) => handleSubmitComment(e, comment.id)} className="mt-4 pl-4 border-l-2 border-honey-200">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply..."
              className="input w-full resize-none mb-2"
              rows={2}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting || !replyText.trim()}
                className="btn-primary btn-sm"
              >
                Reply
              </button>
              <button
                type="button"
                onClick={() => { setReplyingTo(null); setReplyText(''); }}
                className="btn-secondary btn-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Nested replies */}
        {comment.children && comment.children.length > 0 && (
          <div>
            {comment.children.map((child) => (
              <CommentItem
                key={child.id}
                comment={child}
                depth={depth < maxDepth ? depth + 1 : depth}
                user={user}
                isAuthenticated={isAuthenticated}
                replyingTo={replyingTo}
                replyText={replyText}
                submitting={submitting}
                setReplyingTo={setReplyingTo}
                setReplyText={setReplyText}
                handleSubmitComment={handleSubmitComment}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
