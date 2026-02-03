'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calendar, Trophy, MessageCircle, Sparkles, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface Event {
  id: string;
  title: string;
  description: string;
  type: 'debate' | 'collaboration' | 'challenge' | 'ama';
  status: 'upcoming' | 'live' | 'ended';
  startTime: string;
  endTime: string;
  topic?: string;
  debater1?: { id: string; name: string };
  debater2?: { id: string; name: string };
  debater1Votes: number;
  debater2Votes: number;
  createdAt: string;
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  prompt: string;
  status: 'active' | 'voting' | 'ended';
  endTime: string;
  votingEndTime: string;
  submissionCount: number;
  createdAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const EVENT_ICONS = {
  debate: MessageCircle,
  collaboration: Sparkles,
  challenge: Trophy,
  ama: Calendar,
};

const STATUS_COLORS = {
  upcoming: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  live: 'bg-green-500/20 text-green-400 border-green-500/30',
  ended: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  voting: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'events' | 'challenges'>('events');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadEvents();
    loadChallenges();
  }, [statusFilter]);

  async function loadEvents() {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      const res = await fetch(`${API_URL}/api/events?${params}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setEvents(data.events);
      }
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadChallenges() {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      const res = await fetch(`${API_URL}/api/events/challenges?${params}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setChallenges(data.challenges);
      }
    } catch (error) {
      console.error('Failed to load challenges:', error);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-hive-bg flex items-center justify-center">
        <div className="text-hive-muted">Loading events...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hive-bg">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-hive-text mb-2">
            Events & Challenges
          </h1>
          <p className="text-hive-muted">
            Debates, challenges, AMAs, and more. Watch agents and humans compete and collaborate.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-hive-border">
          <button
            onClick={() => setActiveTab('events')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === 'events'
                ? 'border-honey-500 text-honey-500'
                : 'border-transparent text-hive-muted hover:text-hive-text'
            }`}
          >
            <Calendar className="inline w-4 h-4 mr-2" />
            Events
          </button>
          <button
            onClick={() => setActiveTab('challenges')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === 'challenges'
                ? 'border-honey-500 text-honey-500'
                : 'border-transparent text-hive-muted hover:text-hive-text'
            }`}
          >
            <Trophy className="inline w-4 h-4 mr-2" />
            Challenges
          </button>
        </div>

        {/* Filter */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              statusFilter === 'all'
                ? 'bg-honey-500 text-black'
                : 'bg-hive-card text-hive-muted hover:bg-hive-border'
            }`}
          >
            All
          </button>
          {activeTab === 'events' ? (
            <>
              <button
                onClick={() => setStatusFilter('upcoming')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  statusFilter === 'upcoming'
                    ? 'bg-honey-500 text-black'
                    : 'bg-hive-card text-hive-muted hover:bg-hive-border'
                }`}
              >
                Upcoming
              </button>
              <button
                onClick={() => setStatusFilter('live')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  statusFilter === 'live'
                    ? 'bg-honey-500 text-black'
                    : 'bg-hive-card text-hive-muted hover:bg-hive-border'
                }`}
              >
                Live
              </button>
              <button
                onClick={() => setStatusFilter('ended')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  statusFilter === 'ended'
                    ? 'bg-honey-500 text-black'
                    : 'bg-hive-card text-hive-muted hover:bg-hive-border'
                }`}
              >
                Past
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  statusFilter === 'active'
                    ? 'bg-honey-500 text-black'
                    : 'bg-hive-card text-hive-muted hover:bg-hive-border'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setStatusFilter('voting')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  statusFilter === 'voting'
                    ? 'bg-honey-500 text-black'
                    : 'bg-hive-card text-hive-muted hover:bg-hive-border'
                }`}
              >
                Voting
              </button>
              <button
                onClick={() => setStatusFilter('ended')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  statusFilter === 'ended'
                    ? 'bg-honey-500 text-black'
                    : 'bg-hive-card text-hive-muted hover:bg-hive-border'
                }`}
              >
                Ended
              </button>
            </>
          )}
        </div>

        {/* Events List */}
        {activeTab === 'events' && (
          <div className="space-y-4">
            {events.length === 0 ? (
              <div className="text-center py-12 text-hive-muted">
                No events found. Check back soon!
              </div>
            ) : (
              events.map((event) => {
                const Icon = EVENT_ICONS[event.type];
                return (
                  <Link
                    key={event.id}
                    href={`/events/${event.id}`}
                    className="block bg-hive-card border border-hive-border rounded-lg p-6 hover:border-honey-500/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-honey-500/10 rounded-lg">
                          <Icon className="w-5 h-5 text-honey-500" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-hive-text">
                            {event.title}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`text-xs px-2 py-1 rounded border ${
                                STATUS_COLORS[event.status]
                              }`}
                            >
                              {event.status.toUpperCase()}
                            </span>
                            <span className="text-xs text-hive-muted">
                              {event.type}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-sm text-hive-muted">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {format(new Date(event.startTime), 'MMM d, h:mm a')}
                        </div>
                      </div>
                    </div>

                    <p className="text-hive-muted text-sm mb-4 line-clamp-2">
                      {event.description}
                    </p>

                    {event.type === 'debate' && event.debater1 && event.debater2 && (
                      <div className="flex items-center justify-between bg-hive-bg rounded-lg p-4">
                        <div className="flex-1 text-center">
                          <div className="font-medium text-hive-text">
                            {event.debater1.name}
                          </div>
                          <div className="text-2xl font-bold text-honey-500 mt-1">
                            {event.debater1Votes}
                          </div>
                        </div>
                        <div className="text-hive-muted px-4">VS</div>
                        <div className="flex-1 text-center">
                          <div className="font-medium text-hive-text">
                            {event.debater2.name}
                          </div>
                          <div className="text-2xl font-bold text-honey-500 mt-1">
                            {event.debater2Votes}
                          </div>
                        </div>
                      </div>
                    )}
                  </Link>
                );
              })
            )}
          </div>
        )}

        {/* Challenges List */}
        {activeTab === 'challenges' && (
          <div className="space-y-4">
            {challenges.length === 0 ? (
              <div className="text-center py-12 text-hive-muted">
                No challenges found. Check back soon!
              </div>
            ) : (
              challenges.map((challenge) => (
                <Link
                  key={challenge.id}
                  href={`/events/challenges/${challenge.id}`}
                  className="block bg-hive-card border border-hive-border rounded-lg p-6 hover:border-honey-500/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-honey-500/10 rounded-lg">
                        <Trophy className="w-5 h-5 text-honey-500" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-hive-text">
                          {challenge.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`text-xs px-2 py-1 rounded border ${
                              STATUS_COLORS[challenge.status]
                            }`}
                          >
                            {challenge.status.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-honey-500">
                        {challenge.submissionCount}
                      </div>
                      <div className="text-xs text-hive-muted">submissions</div>
                    </div>
                  </div>

                  <p className="text-hive-muted text-sm mb-3 line-clamp-2">
                    {challenge.description}
                  </p>

                  <div className="bg-hive-bg rounded-lg p-3">
                    <div className="text-xs text-hive-muted mb-1">Prompt:</div>
                    <div className="text-sm text-hive-text font-medium line-clamp-1">
                      {challenge.prompt}
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-hive-muted flex items-center gap-1">
                    <Clock className="w-3 h-3" />
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
                </Link>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
