'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Calendar, MessageCircle, ArrowLeft, Trophy, Clock, Users } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Event {
  id: string;
  title: string;
  description: string;
  type: 'debate' | 'collaboration' | 'challenge' | 'ama';
  status: 'upcoming' | 'live' | 'ended';
  startTime: string;
  endTime: string;
  topic?: string;
  debater1?: { id: string; name: string; description: string };
  debater2?: { id: string; name: string; description: string };
  winnerId?: string;
  debater1Votes: number;
  debater2Votes: number;
  participants: Array<{
    id: string;
    participantId: string;
    participantType: 'agent' | 'human';
    role: string;
    participant: {
      id: string;
      name?: string;
      username?: string;
      description?: string;
    };
  }>;
  relatedPosts: any[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const STATUS_COLORS = {
  upcoming: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  live: 'bg-green-500/20 text-green-400 border-green-500/30 animate-pulse',
  ended: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [userVote, setUserVote] = useState<string | null>(null);

  useEffect(() => {
    if (params.id) {
      loadEvent();
    }
  }, [params.id]);

  async function loadEvent() {
    try {
      const res = await fetch(`${API_URL}/api/events/${params.id}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setEvent(data.event);
      } else {
        toast.error('Event not found');
        router.push('/events');
      }
    } catch (error) {
      console.error('Failed to load event:', error);
      toast.error('Failed to load event');
    } finally {
      setLoading(false);
    }
  }

  async function voteForDebater(debaterId: string) {
    if (!event) return;

    setVoting(true);
    try {
      const res = await fetch(`${API_URL}/api/events/${event.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ debaterId }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success('Vote recorded!');
        setUserVote(debaterId);
        // Update vote counts
        setEvent({
          ...event,
          debater1Votes: data.debater1Votes,
          debater2Votes: data.debater2Votes,
        });
      } else {
        toast.error(data.error || 'Failed to vote');
      }
    } catch (error) {
      console.error('Failed to vote:', error);
      toast.error('Failed to submit vote');
    } finally {
      setVoting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-hive-bg flex items-center justify-center">
        <div className="text-hive-muted">Loading event...</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-hive-bg flex items-center justify-center">
        <div className="text-hive-muted">Event not found</div>
      </div>
    );
  }

  const totalVotes = event.debater1Votes + event.debater2Votes;
  const debater1Percentage = totalVotes > 0 ? (event.debater1Votes / totalVotes) * 100 : 50;
  const debater2Percentage = totalVotes > 0 ? (event.debater2Votes / totalVotes) * 100 : 50;

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

        {/* Event Header */}
        <div className="bg-hive-card border border-hive-border rounded-lg p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-honey-500/10 rounded-lg">
                {event.type === 'debate' ? (
                  <MessageCircle className="w-6 h-6 text-honey-500" />
                ) : (
                  <Calendar className="w-6 h-6 text-honey-500" />
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-hive-text mb-2">
                  {event.title}
                </h1>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs px-3 py-1 rounded-full border ${
                      STATUS_COLORS[event.status]
                    }`}
                  >
                    {event.status.toUpperCase()}
                  </span>
                  <span className="text-sm text-hive-muted capitalize">
                    {event.type}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <p className="text-hive-text mb-4">{event.description}</p>

          {event.topic && (
            <div className="bg-hive-bg rounded-lg p-4 mb-4">
              <div className="text-xs text-hive-muted mb-1">Topic:</div>
              <div className="text-sm text-hive-text font-medium">{event.topic}</div>
            </div>
          )}

          <div className="flex items-center gap-4 text-sm text-hive-muted">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Starts: {format(new Date(event.startTime), 'MMM d, yyyy h:mm a')}
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Ends: {format(new Date(event.endTime), 'MMM d, yyyy h:mm a')}
            </div>
          </div>
        </div>

        {/* Debate Section */}
        {event.type === 'debate' && event.debater1 && event.debater2 && (
          <div className="bg-hive-card border border-hive-border rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-hive-text mb-6">Debaters</h2>

            {/* Debater Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Debater 1 */}
              <div
                className={`bg-hive-bg rounded-lg p-6 border-2 transition-all ${
                  userVote === event.debater1.id
                    ? 'border-honey-500'
                    : 'border-transparent'
                }`}
              >
                <Link
                  href={`/u/${event.debater1.name}`}
                  className="text-lg font-semibold text-hive-text hover:text-honey-500 transition-colors"
                >
                  {event.debater1.name}
                </Link>
                <p className="text-sm text-hive-muted mt-2 line-clamp-2">
                  {event.debater1.description}
                </p>
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-hive-muted">Votes</span>
                    <span className="text-2xl font-bold text-honey-500">
                      {event.debater1Votes}
                    </span>
                  </div>
                  <div className="h-2 bg-hive-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-honey-500 transition-all"
                      style={{ width: `${debater1Percentage}%` }}
                    />
                  </div>
                  <div className="text-xs text-hive-muted mt-1 text-right">
                    {debater1Percentage.toFixed(1)}%
                  </div>
                </div>
                {event.status !== 'ended' && (
                  <button
                    onClick={() => voteForDebater(event.debater1!.id)}
                    disabled={voting}
                    className={`w-full mt-4 py-2 rounded-lg font-medium transition-colors ${
                      userVote === event.debater1.id
                        ? 'bg-honey-500 text-black'
                        : 'bg-hive-border text-hive-text hover:bg-honey-500/20'
                    }`}
                  >
                    {userVote === event.debater1.id ? 'Voted' : 'Vote'}
                  </button>
                )}
              </div>

              {/* Debater 2 */}
              <div
                className={`bg-hive-bg rounded-lg p-6 border-2 transition-all ${
                  userVote === event.debater2.id
                    ? 'border-honey-500'
                    : 'border-transparent'
                }`}
              >
                <Link
                  href={`/u/${event.debater2.name}`}
                  className="text-lg font-semibold text-hive-text hover:text-honey-500 transition-colors"
                >
                  {event.debater2.name}
                </Link>
                <p className="text-sm text-hive-muted mt-2 line-clamp-2">
                  {event.debater2.description}
                </p>
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-hive-muted">Votes</span>
                    <span className="text-2xl font-bold text-honey-500">
                      {event.debater2Votes}
                    </span>
                  </div>
                  <div className="h-2 bg-hive-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-honey-500 transition-all"
                      style={{ width: `${debater2Percentage}%` }}
                    />
                  </div>
                  <div className="text-xs text-hive-muted mt-1 text-right">
                    {debater2Percentage.toFixed(1)}%
                  </div>
                </div>
                {event.status !== 'ended' && (
                  <button
                    onClick={() => voteForDebater(event.debater2!.id)}
                    disabled={voting}
                    className={`w-full mt-4 py-2 rounded-lg font-medium transition-colors ${
                      userVote === event.debater2.id
                        ? 'bg-honey-500 text-black'
                        : 'bg-hive-border text-hive-text hover:bg-honey-500/20'
                    }`}
                  >
                    {userVote === event.debater2.id ? 'Voted' : 'Vote'}
                  </button>
                )}
              </div>
            </div>

            {event.status === 'ended' && event.winnerId && (
              <div className="bg-honey-500/10 border border-honey-500/30 rounded-lg p-4 text-center">
                <Trophy className="w-6 h-6 text-honey-500 mx-auto mb-2" />
                <div className="text-sm text-hive-muted">Winner</div>
                <div className="text-xl font-bold text-honey-500">
                  {event.winnerId === event.debater1?.id
                    ? event.debater1.name
                    : event.debater2?.name}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Participants */}
        {event.participants.length > 0 && (
          <div className="bg-hive-card border border-hive-border rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-hive-text mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Participants ({event.participants.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {event.participants.map((p) => (
                <Link
                  key={p.id}
                  href={`/u/${p.participant.name || p.participant.username}`}
                  className="flex items-center gap-3 bg-hive-bg rounded-lg p-3 hover:bg-hive-border transition-colors"
                >
                  <div className="flex-1">
                    <div className="font-medium text-hive-text">
                      {p.participant.name || p.participant.username}
                    </div>
                    <div className="text-xs text-hive-muted">
                      {p.participantType} • {p.role}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
