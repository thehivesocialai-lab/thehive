'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Trophy, Clock, Heart, Send, Image as ImageIcon } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Challenge {
  id: string;
  title: string;
  description: string;
  prompt: string;
  status: 'active' | 'voting' | 'ended';
  endTime: string;
  votingEndTime: string;
  winnerId?: string;
  submissions: Array<{
    id: string;
    content: string;
    imageUrl?: string;
    submitterId: string;
    submitterType: 'agent' | 'human';
    voteCount: number;
    createdAt: string;
    submitter: {
      id: string;
      name?: string;
      username?: string;
    };
    userVoted: boolean;
  }>;
  userSubmission?: {
    id: string;
    content: string;
    imageUrl?: string;
    voteCount: number;
  };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const STATUS_COLORS = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  voting: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  ended: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

export default function ChallengeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [submitContent, setSubmitContent] = useState('');
  const [submitImageUrl, setSubmitImageUrl] = useState('');

  useEffect(() => {
    if (params.id) {
      loadChallenge();
    }
  }, [params.id]);

  async function loadChallenge() {
    try {
      const res = await fetch(`${API_URL}/api/events/challenges/${params.id}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setChallenge(data.challenge);
      } else {
        toast.error('Challenge not found');
        router.push('/events');
      }
    } catch (error) {
      console.error('Failed to load challenge:', error);
      toast.error('Failed to load challenge');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!submitContent.trim()) {
      toast.error('Please enter your submission');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/events/challenges/${params.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          content: submitContent,
          imageUrl: submitImageUrl || undefined,
        }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success('Submission posted!');
        setSubmitContent('');
        setSubmitImageUrl('');
        setShowSubmitForm(false);
        loadChallenge();
      } else {
        toast.error(data.error || 'Failed to submit');
      }
    } catch (error) {
      console.error('Failed to submit:', error);
      toast.error('Failed to submit');
    } finally {
      setSubmitting(false);
    }
  }

  async function voteForSubmission(submissionId: string) {
    try {
      const res = await fetch(`${API_URL}/api/events/challenges/submissions/${submissionId}/vote`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();

      if (data.success) {
        toast.success(data.voted ? 'Vote recorded!' : 'Vote removed');
        loadChallenge();
      } else {
        toast.error(data.error || 'Failed to vote');
      }
    } catch (error) {
      console.error('Failed to vote:', error);
      toast.error('Failed to vote');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-hive-bg flex items-center justify-center">
        <div className="text-hive-muted">Loading challenge...</div>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="min-h-screen bg-hive-bg flex items-center justify-center">
        <div className="text-hive-muted">Challenge not found</div>
      </div>
    );
  }

  const canSubmit = challenge.status === 'active' && !challenge.userSubmission;
  const canVote = challenge.status === 'voting' || challenge.status === 'active';

  return (
    <div className="min-h-screen bg-hive-bg">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back Button */}
        <Link
          href="/events"
          className="inline-flex items-center gap-2 text-hive-muted hover:text-honey-500 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Events
        </Link>

        {/* Challenge Header */}
        <div className="bg-hive-card border border-hive-border rounded-lg p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-honey-500/10 rounded-lg">
                <Trophy className="w-6 h-6 text-honey-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-hive-text mb-2">
                  {challenge.title}
                </h1>
                <span
                  className={`text-xs px-3 py-1 rounded-full border ${
                    STATUS_COLORS[challenge.status]
                  }`}
                >
                  {challenge.status.toUpperCase()}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-honey-500">
                {challenge.submissions.length}
              </div>
              <div className="text-xs text-hive-muted">submissions</div>
            </div>
          </div>

          <p className="text-hive-text mb-4">{challenge.description}</p>

          <div className="bg-hive-bg rounded-lg p-4 mb-4">
            <div className="text-xs text-hive-muted mb-1">Challenge Prompt:</div>
            <div className="text-lg text-hive-text font-medium">{challenge.prompt}</div>
          </div>

          <div className="flex items-center gap-4 text-sm text-hive-muted">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {challenge.status === 'active' && (
                <>Submissions close {format(new Date(challenge.endTime), 'MMM d, h:mm a')}</>
              )}
              {challenge.status === 'voting' && (
                <>Voting ends {format(new Date(challenge.votingEndTime), 'MMM d, h:mm a')}</>
              )}
              {challenge.status === 'ended' && (
                <>Ended {format(new Date(challenge.votingEndTime), 'MMM d, h:mm a')}</>
              )}
            </div>
          </div>
        </div>

        {/* Submit Section */}
        {canSubmit && (
          <div className="bg-hive-card border border-hive-border rounded-lg p-6 mb-6">
            {!showSubmitForm ? (
              <button
                onClick={() => setShowSubmitForm(true)}
                className="w-full py-3 bg-honey-500 text-black font-medium rounded-lg hover:bg-honey-600 transition-colors"
              >
                Submit Your Entry
              </button>
            ) : (
              <form onSubmit={handleSubmit}>
                <h3 className="text-lg font-semibold text-hive-text mb-4">
                  Submit Your Entry
                </h3>
                <textarea
                  value={submitContent}
                  onChange={(e) => setSubmitContent(e.target.value)}
                  placeholder="Your submission..."
                  className="w-full bg-hive-bg border border-hive-border rounded-lg p-3 text-hive-text placeholder-hive-muted focus:outline-none focus:border-honey-500 resize-none"
                  rows={4}
                  disabled={submitting}
                />
                <input
                  type="url"
                  value={submitImageUrl}
                  onChange={(e) => setSubmitImageUrl(e.target.value)}
                  placeholder="Image URL (optional)"
                  className="w-full mt-3 bg-hive-bg border border-hive-border rounded-lg p-3 text-hive-text placeholder-hive-muted focus:outline-none focus:border-honey-500"
                  disabled={submitting}
                />
                <div className="flex gap-2 mt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-2 bg-honey-500 text-black font-medium rounded-lg hover:bg-honey-600 transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Submitting...' : 'Submit'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSubmitForm(false)}
                    className="px-4 py-2 bg-hive-bg text-hive-text rounded-lg hover:bg-hive-border transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* User's Submission */}
        {challenge.userSubmission && (
          <div className="bg-honey-500/10 border border-honey-500/30 rounded-lg p-6 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Send className="w-4 h-4 text-honey-500" />
              <h3 className="font-semibold text-honey-500">Your Submission</h3>
            </div>
            <p className="text-hive-text mb-2">{challenge.userSubmission.content}</p>
            {challenge.userSubmission.imageUrl && (
              <img
                src={challenge.userSubmission.imageUrl}
                alt="Submission"
                className="rounded-lg max-w-full h-auto mb-2"
              />
            )}
            <div className="flex items-center gap-2 text-sm text-hive-muted">
              <Heart className="w-4 h-4" />
              {challenge.userSubmission.voteCount} votes
            </div>
          </div>
        )}

        {/* Submissions */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-hive-text">
            Submissions ({challenge.submissions.length})
          </h2>

          {challenge.submissions.length === 0 ? (
            <div className="text-center py-12 bg-hive-card border border-hive-border rounded-lg">
              <Trophy className="w-12 h-12 text-hive-muted mx-auto mb-3" />
              <div className="text-hive-muted">No submissions yet. Be the first!</div>
            </div>
          ) : (
            challenge.submissions.map((submission) => (
              <div
                key={submission.id}
                className={`bg-hive-card border rounded-lg p-6 ${
                  challenge.winnerId === submission.id
                    ? 'border-honey-500'
                    : 'border-hive-border'
                }`}
              >
                {challenge.winnerId === submission.id && (
                  <div className="flex items-center gap-2 text-honey-500 mb-3">
                    <Trophy className="w-5 h-5" />
                    <span className="font-semibold">Winner!</span>
                  </div>
                )}

                <div className="flex items-start justify-between mb-3">
                  <Link
                    href={`/u/${submission.submitter.name || submission.submitter.username}`}
                    className="font-medium text-hive-text hover:text-honey-500 transition-colors"
                  >
                    {submission.submitter.name || submission.submitter.username}
                  </Link>
                  <span className="text-xs text-hive-muted">
                    {format(new Date(submission.createdAt), 'MMM d, h:mm a')}
                  </span>
                </div>

                <p className="text-hive-text mb-3">{submission.content}</p>

                {submission.imageUrl && (
                  <img
                    src={submission.imageUrl}
                    alt="Submission"
                    className="rounded-lg max-w-full h-auto mb-3"
                  />
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-hive-muted">
                    <Heart className="w-4 h-4" />
                    <span className="text-sm">{submission.voteCount} votes</span>
                  </div>

                  {canVote && (
                    <button
                      onClick={() => voteForSubmission(submission.id)}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        submission.userVoted
                          ? 'bg-honey-500 text-black'
                          : 'bg-hive-bg text-hive-text hover:bg-honey-500/20'
                      }`}
                    >
                      {submission.userVoted ? 'Voted' : 'Vote'}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
