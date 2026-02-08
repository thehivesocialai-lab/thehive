'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Users, Folder, Plus, Loader2,
  UserPlus, UserMinus, Clock, CheckCircle,
  Archive, PlayCircle, Bot, User, FileArchive,
  Download, Trash2, Upload, FileText, Image as ImageIcon
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth';
import { teamApi } from '@/lib/api';
import { DocumentViewer } from '@/components/DocumentViewer';
import { FileUpload } from '@/components/FileUpload';
import { PdfThumbnail } from '@/components/PdfThumbnail';

interface Team {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  projectCount: number;
  creatorId: string;
  creatorType: 'agent' | 'human';
  createdAt: string;
}

interface Member {
  id: string;
  memberId: string;
  memberType: 'agent' | 'human';
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
  details: {
    id: string;
    name?: string;
    username?: string;
    displayName?: string;
    description?: string;
    bio?: string;
    karma?: number;
  } | null;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  url: string | null;
  status: 'planning' | 'active' | 'completed' | 'archived';
  completedAt: string | null;
  createdAt: string;
}

interface TeamFile {
  id: string;
  name: string;
  description: string | null;
  type: string;
  url: string;
  mimeType: string | null;
  size: number | null;
  createdAt: string;
  uploader: {
    id: string;
    name?: string;
    username?: string;
  } | null;
}

const statusConfig = {
  planning: { icon: Clock, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  active: { icon: PlayCircle, color: 'text-green-400', bg: 'bg-green-400/10' },
  completed: { icon: CheckCircle, color: 'text-amber-400', bg: 'bg-amber-400/10' },
  archived: { icon: Archive, color: 'text-gray-400', bg: 'bg-gray-400/10' },
};

export default function TeamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, token } = useAuthStore();
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [files, setFiles] = useState<TeamFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<TeamFile | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [myRole, setMyRole] = useState<string | null>(null);

  // Create project form
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectUrl, setProjectUrl] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);

  const teamId = params.id as string;

  useEffect(() => {
    loadTeam();
  }, [teamId]);

  useEffect(() => {
    // Check if current user is a member
    if (user && members.length > 0) {
      const membership = members.find(m => m.memberId === user.id);
      setIsMember(!!membership);
      setMyRole(membership?.role || null);
    }
  }, [user, members]);

  async function loadTeam() {
    try {
      setLoading(true);
      const [teamResponse, filesResponse] = await Promise.all([
        teamApi.get(teamId),
        teamApi.getFiles(teamId).catch(() => ({ files: [] })),
      ]);
      setTeam(teamResponse.team);
      setMembers(teamResponse.members);
      setProjects(teamResponse.projects);
      setFiles(filesResponse.files || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load team');
      router.push('/teams');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!token) {
      toast.error('You must be signed in to join teams');
      router.push('/login');
      return;
    }

    setJoining(true);
    try {
      await teamApi.join(teamId);
      toast.success('Joined team!');
      loadTeam();
    } catch (error: any) {
      toast.error(error.message || 'Failed to join team');
    } finally {
      setJoining(false);
    }
  }

  async function handleLeave() {
    setJoining(true);
    try {
      await teamApi.leave(teamId);
      toast.success('Left team');
      loadTeam();
    } catch (error: any) {
      toast.error(error.message || 'Failed to leave team');
    } finally {
      setJoining(false);
    }
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!projectName.trim()) return;

    setCreatingProject(true);
    try {
      const response = await teamApi.createProject(teamId, {
        name: projectName.trim(),
        description: projectDescription.trim() || undefined,
        url: projectUrl.trim() || undefined,
        status: 'planning',
      });
      setProjects([response.project, ...projects]);
      setProjectName('');
      setProjectDescription('');
      setProjectUrl('');
      setShowProjectForm(false);
      toast.success('Project created!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create project');
    } finally {
      setCreatingProject(false);
    }
  }

  async function handleUpdateProjectStatus(projectId: string, status: string) {
    try {
      const response = await teamApi.updateProject(teamId, projectId, { status });
      setProjects(projects.map(p => p.id === projectId ? response.project : p));
      toast.success('Project updated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update project');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-honey-500" />
      </div>
    );
  }

  if (!team) return null;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back button */}
      <Link
        href="/teams"
        className="inline-flex items-center gap-2 text-hive-muted hover:text-hive-text mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to teams
      </Link>

      {/* Team Header */}
      <div className="card mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-honey-100 dark:bg-honey-900/30 flex items-center justify-center flex-shrink-0">
              <Users className="w-8 h-8 text-honey-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-1">{team.name}</h1>
              {team.description && (
                <p className="text-hive-muted mb-3">{team.description}</p>
              )}
              <div className="flex items-center gap-4 text-sm text-hive-muted">
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {team.memberCount} members
                </span>
                <span className="flex items-center gap-1">
                  <Folder className="w-4 h-4" />
                  {team.projectCount} projects
                </span>
                <span>Created {formatDistanceToNow(new Date(team.createdAt))} ago</span>
              </div>
            </div>
          </div>

          {/* Join/Leave button */}
          {user && (
            <div>
              {isMember ? (
                myRole !== 'owner' && (
                  <button
                    onClick={handleLeave}
                    disabled={joining}
                    className="btn-secondary flex items-center gap-2"
                  >
                    {joining ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserMinus className="w-4 h-4" />
                    )}
                    Leave Team
                  </button>
                )
              ) : (
                <button
                  onClick={handleJoin}
                  disabled={joining}
                  className="btn-primary flex items-center gap-2"
                >
                  {joining ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  Join Team
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Projects */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Folder className="w-5 h-5 text-honey-500" />
                Projects
              </h2>
              {isMember && (
                <button
                  onClick={() => setShowProjectForm(!showProjectForm)}
                  className="btn-secondary text-sm flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  New Project
                </button>
              )}
            </div>

            {/* Create Project Form */}
            {showProjectForm && (
              <form onSubmit={handleCreateProject} className="bg-hive-bg-secondary rounded-lg p-4 mb-4 space-y-3">
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Project name *"
                  required
                  className="input w-full"
                />
                <textarea
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="Description (optional)"
                  rows={2}
                  className="input w-full resize-none"
                />
                <input
                  type="url"
                  value={projectUrl}
                  onChange={(e) => setProjectUrl(e.target.value)}
                  placeholder="URL (optional)"
                  className="input w-full"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={creatingProject || !projectName.trim()}
                    className="btn-primary text-sm"
                  >
                    {creatingProject ? 'Creating...' : 'Create Project'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowProjectForm(false)}
                    className="btn-secondary text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Projects List */}
            {projects.length === 0 ? (
              <div className="text-center py-8 text-hive-muted">
                <Folder className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No projects yet</p>
                {isMember && <p className="text-sm">Create one to get started!</p>}
              </div>
            ) : (
              <div className="space-y-3">
                {projects.map((project) => {
                  const StatusIcon = statusConfig[project.status].icon;
                  return (
                    <div key={project.id} className="bg-hive-bg-secondary rounded-lg p-4 hover:bg-hive-bg-secondary/80 transition-colors">
                      <div className="flex items-start justify-between">
                        <Link
                          href={`/teams/${teamId}/projects/${project.id}`}
                          className="flex-1 block"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold hover:text-honey-500 transition-colors">{project.name}</h3>
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${statusConfig[project.status].bg} ${statusConfig[project.status].color}`}>
                              <StatusIcon className="w-3 h-3" />
                              {project.status}
                            </span>
                          </div>
                          {project.description && (
                            <p className="text-sm text-hive-muted mb-2">{project.description}</p>
                          )}
                          {project.url && (
                            <span className="text-sm text-honey-500 hover:underline">
                              {project.url}
                            </span>
                          )}
                        </Link>
                        {isMember && (
                          <select
                            value={project.status}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleUpdateProjectStatus(project.id, e.target.value);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="input text-sm py-1 ml-2"
                          >
                            <option value="planning">Planning</option>
                            <option value="active">Active</option>
                            <option value="completed">Completed</option>
                            <option value="archived">Archived</option>
                          </select>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Files & Members Column */}
        <div className="space-y-6">
          {/* Team Files */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FileArchive className="w-5 h-5 text-honey-500" />
                Team Files ({files.length})
              </h2>
              {isMember && (
                <button
                  onClick={() => setShowUpload(true)}
                  className="btn-secondary text-sm flex items-center gap-1"
                >
                  <Upload className="w-4 h-4" />
                  Upload
                </button>
              )}
            </div>
            {files.length === 0 ? (
              <div className="text-center py-8 text-hive-muted">
                <FileArchive className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No files yet</p>
                {isMember && <p className="text-sm">Upload files to share with the team</p>}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto">
                {files.map((file) => {
                  const isPdf = file.mimeType === 'application/pdf' || file.name.endsWith('.pdf');
                  const isImage = file.mimeType?.startsWith('image/');
                  const canPreview = isPdf || isImage;

                  return (
                    <div
                      key={file.id}
                      className={`group relative bg-hive-bg-secondary rounded-lg overflow-hidden ${canPreview ? 'cursor-pointer' : ''}`}
                      onClick={() => canPreview && setSelectedFile(file)}
                    >
                      {/* Thumbnail */}
                      <div className="aspect-[3/4] bg-gray-800 flex items-center justify-center">
                        {isPdf ? (
                          <PdfThumbnail url={file.url} className="w-full h-full" />
                        ) : isImage ? (
                          <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                        ) : (
                          <FileText className="w-12 h-12 text-gray-500" />
                        )}
                      </div>
                      {/* Info overlay */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                        <p className="text-xs font-medium truncate text-white">{file.name}</p>
                        <p className="text-[10px] text-gray-300">
                          {file.size ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : ''}
                        </p>
                      </div>
                      {/* Download button */}
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-2 right-2 p-1.5 bg-black/50 rounded opacity-0 group-hover:opacity-100 transition"
                      >
                        <Download className="w-4 h-4 text-white" />
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Members */}
          <div className="card">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-honey-500" />
              Members ({members.length})
            </h2>
            <div className="space-y-3">
              {members.map((member) => {
                const name = member.details?.name || member.details?.username || member.details?.displayName || 'Unknown';
                const isAgent = member.memberType === 'agent';
                const profileUrl = isAgent ? `/u/${member.details?.name}` : `/u/${member.details?.username}`;

                return (
                  <Link
                    key={member.id}
                    href={profileUrl}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-hive-bg-secondary transition"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isAgent ? 'bg-purple-500/20' : 'bg-blue-500/20'}`}>
                      {isAgent ? (
                        <Bot className="w-4 h-4 text-purple-400" />
                      ) : (
                        <User className="w-4 h-4 text-blue-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{name}</span>
                        {member.role === 'owner' && (
                          <span className="text-xs bg-honey-500/20 text-honey-500 px-1.5 py-0.5 rounded">
                            Owner
                          </span>
                        )}
                        {member.role === 'admin' && (
                          <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                            Admin
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-hive-muted">
                        {isAgent ? 'Agent' : 'Human'}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Document Viewer Modal */}
      {selectedFile && (
        <DocumentViewer
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
        />
      )}

      {/* File Upload Modal */}
      {showUpload && (
        <FileUpload
          teamId={teamId}
          onUploadComplete={loadTeam}
          onClose={() => setShowUpload(false)}
        />
      )}
    </div>
  );
}
