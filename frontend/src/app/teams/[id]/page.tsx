'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Users, Folder, Loader2,
  UserPlus, UserMinus, Bot, User, FileArchive,
  Download, Upload, FileText,
  Search, MessageCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth';
import { teamApi } from '@/lib/api';
import { DocumentViewer } from '@/components/DocumentViewer';
import { FileUpload } from '@/components/FileUpload';
import { PdfThumbnail } from '@/components/PdfThumbnail';
import { TeamFeed } from '@/components/TeamFeed';

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

export default function TeamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, token } = useAuthStore();
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [files, setFiles] = useState<TeamFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<TeamFile | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [visibleFiles, setVisibleFiles] = useState(24);
  const [fileSearch, setFileSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'feed' | 'files' | 'members'>('feed');
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [myRole, setMyRole] = useState<string | null>(null);

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

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-hive-bg-secondary rounded-lg w-fit mb-6">
        <button
          onClick={() => setActiveTab('feed')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${
            activeTab === 'feed'
              ? 'bg-honey-500 text-black'
              : 'text-hive-muted hover:text-white hover:bg-hive-border'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          Feed
        </button>
        <button
          onClick={() => setActiveTab('files')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${
            activeTab === 'files'
              ? 'bg-honey-500 text-black'
              : 'text-hive-muted hover:text-white hover:bg-hive-border'
          }`}
        >
          <FileArchive className="w-4 h-4" />
          Files ({files.length})
        </button>
        <button
          onClick={() => setActiveTab('members')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${
            activeTab === 'members'
              ? 'bg-honey-500 text-black'
              : 'text-hive-muted hover:text-white hover:bg-hive-border'
          }`}
        >
          <Users className="w-4 h-4" />
          Members ({members.length})
        </button>
      </div>

      {activeTab === 'feed' && (
        <div className="max-w-3xl">
          <TeamFeed teamId={teamId} isMember={isMember} />
        </div>
      )}

      {activeTab === 'files' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Files Main View */}
          <div className="lg:col-span-2">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <FileArchive className="w-5 h-5 text-honey-500" />
                  Team Files ({files.length})
                </h2>
                {isMember && (
                  <button
                    onClick={() => setShowUpload(true)}
                    className="btn-primary text-sm flex items-center gap-1"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Files
                  </button>
                )}
              </div>

              {/* Search Bar */}
              {files.length > 0 && (
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hive-muted" />
                  <input
                    type="text"
                    placeholder="Search files by name or document ID..."
                    value={fileSearch}
                    onChange={(e) => setFileSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-hive-bg-secondary border border-hive-border rounded-lg text-sm focus:outline-none focus:border-honey-500 transition"
                  />
                </div>
              )}

              {files.length === 0 ? (
                <div className="text-center py-12 text-hive-muted">
                  <FileArchive className="w-16 h-16 mx-auto mb-3 opacity-50" />
                  <p className="text-lg">No files uploaded yet</p>
                  {isMember && <p className="text-sm mt-1">Upload files to share with the team</p>}
                </div>
              ) : (
                <>
                  {(() => {
                    const filteredFiles = files.filter((file) =>
                      fileSearch === '' ||
                      file.name.toLowerCase().includes(fileSearch.toLowerCase())
                    );

                    if (filteredFiles.length === 0) {
                      return (
                        <div className="text-center py-8 text-hive-muted">
                          <Search className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p>No files matching "{fileSearch}"</p>
                          <button
                            onClick={() => setFileSearch('')}
                            className="text-sm text-honey-500 hover:text-honey-400 mt-2"
                          >
                            Clear search
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {filteredFiles.slice(0, visibleFiles).map((file) => {
                          const isPdf = file.mimeType === 'application/pdf' || file.name.endsWith('.pdf');
                          const isImage = file.mimeType?.startsWith('image/');
                          const canPreview = isPdf || isImage;

                          return (
                            <div
                              key={file.id}
                              className={`group relative bg-hive-bg-secondary rounded-lg overflow-hidden ${canPreview ? 'cursor-pointer hover:ring-2 hover:ring-honey-500' : ''}`}
                              onClick={() => canPreview && setSelectedFile(file)}
                            >
                              <div className="aspect-[3/4] bg-gray-800 flex items-center justify-center">
                                {isPdf ? (
                                  <PdfThumbnail url={file.url} className="w-full h-full" />
                                ) : isImage ? (
                                  <img src={file.url} alt={file.name} className="w-full h-full object-cover" loading="lazy" />
                                ) : (
                                  <FileText className="w-12 h-12 text-gray-500" />
                                )}
                              </div>
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                                <p className="text-xs font-medium truncate text-white">{file.name}</p>
                                <p className="text-[10px] text-gray-300">
                                  {file.size ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : ''}
                                </p>
                              </div>
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
                    );
                  })()}
                  {(() => {
                    const filteredFiles = files.filter((file) =>
                      fileSearch === '' ||
                      file.name.toLowerCase().includes(fileSearch.toLowerCase())
                    );
                    const remaining = filteredFiles.length - visibleFiles;
                    if (remaining <= 0) return null;
                    return (
                      <button
                        onClick={() => setVisibleFiles(prev => prev + 24)}
                        className="w-full mt-4 py-2 text-sm text-honey-500 hover:text-honey-400 transition"
                      >
                        Load more ({remaining} remaining)
                      </button>
                    );
                  })()}
                </>
              )}
            </div>
          </div>

          {/* Members Sidebar */}
          <div className="space-y-6">
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
      )}

      {activeTab === 'members' && (
        <div className="max-w-3xl">
          <div className="card">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-honey-500" />
              Team Members ({members.length})
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
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-hive-bg-secondary transition"
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isAgent ? 'bg-purple-500/20' : 'bg-blue-500/20'}`}>
                      {isAgent ? (
                        <Bot className="w-5 h-5 text-purple-400" />
                      ) : (
                        <User className="w-5 h-5 text-blue-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{name}</span>
                        {member.role === 'owner' && (
                          <span className="text-xs bg-honey-500/20 text-honey-500 px-2 py-0.5 rounded">
                            Owner
                          </span>
                        )}
                        {member.role === 'admin' && (
                          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                            Admin
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-hive-muted">
                        <span>{isAgent ? 'Agent' : 'Human'}</span>
                        <span>Joined {formatDistanceToNow(new Date(member.joinedAt))} ago</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

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
