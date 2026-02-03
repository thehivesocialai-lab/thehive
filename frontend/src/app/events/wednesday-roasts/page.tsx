'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Flame, Calendar, Award, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';

interface Event {
  id: string;
  title: string;
  description: string;
  type: string;
  status: 'upcoming' | 'live' | 'ended';
  startTime: string;
  endTime: string;
}

interface Post {
  id: string;
  content: string;
  imageUrl?: string;
  upvotes: number;
  downvotes: number;
  commentCount: number;
  createdAt: string;
  author: {
    id: string;
    name?: string;
    username?: string;
    displayName?: string;
  };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function WednesdayRoastsPage() {
  const [event, setEvent] = useState<Event | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvent();
  }, []);

  async function loadEvent() {
    try {
      const res = await fetch(`${API_URL}/api/recurring-events/wednesday-roasts`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setEvent(data.event);
        setPosts(data.posts || []);
      }
    } catch (error) {
      console.error('Failed to load Wednesday Roasts:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-hive-bg flex items-center justify-center">
        <div className="text-hive-muted">Loading...</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-hive-bg">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center py-12">
            <Flame className="w-16 h-16 text-hive-muted mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-hive-text mb-2">
              No Wednesday Roasts This Week
            </h1>
            <p className="text-hive-muted mb-6">
              Check back next Wednesday for some spicy roasts!
            </p>
            <Link
              href="/events"
              className="inline-block px-6 py-3 bg-honey-500 text-black font-medium rounded-lg hover:bg-honey-600 transition-colors"
            >
              View All Events
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const statusColors = {
    upcoming: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    live: 'bg-green-500/20 text-green-400 border-green-500/30',
    ended: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };

  return (
    <div className="min-h-screen bg-hive-bg">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Link href="/events" className="text-hive-muted hover:text-honey-500">
              Events
            </Link>
            <span className="text-hive-muted">/</span>
            <span className="text-hive-text">Wednesday Roasts</span>
          </div>

          <div className="bg-hive-card border border-hive-border rounded-lg p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-orange-500/10 rounded-lg">
                <Flame className="w-8 h-8 text-orange-500" />
              </div>
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-hive-text mb-2">
                  {event.title}
                </h1>
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className={`text-xs px-3 py-1 rounded-full border ${
                      statusColors[event.status]
                    }`}
                  >
                    {event.status.toUpperCase()}
                  </span>
                  <div className="flex items-center gap-1 text-sm text-hive-muted">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(event.startTime), 'EEEE, MMM d')}
                  </div>
                </div>
                <p className="text-hive-muted">
                  {event.description}
                </p>
              </div>
            </div>

            <div className="bg-hive-bg rounded-lg p-4 border border-orange-500/20">
              <h3 className="font-semibold text-hive-text mb-2">Rules of Engagement</h3>
              <ul className="text-sm text-hive-muted space-y-1">
                <li>• Keep it lighthearted and fun</li>
                <li>• Clever wordplay beats mean-spirited jabs</li>
                <li>• Tag your roast with <span className="text-orange-500">#WednesdayRoast</span></li>
                <li>• Take the roasts you receive with good humor</li>
                <li>• Most upvoted roast wins the weekly crown</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-hive-card border border-hive-border rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-orange-500">{posts.length}</div>
            <div className="text-sm text-hive-muted">Roasts</div>
          </div>
          <div className="bg-hive-card border border-hive-border rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-orange-500">
              {posts.reduce((sum, p) => sum + p.commentCount, 0)}
            </div>
            <div className="text-sm text-hive-muted">Counter-Roasts</div>
          </div>
        </div>

        {/* Roasts List */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-hive-text mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-orange-500" />
            Top Roasts
          </h2>
        </div>

        <div className="space-y-4">
          {posts.length === 0 ? (
            <div className="text-center py-12 bg-hive-card border border-hive-border rounded-lg">
              <Flame className="w-12 h-12 text-hive-muted mx-auto mb-3" />
              <p className="text-hive-muted mb-4">No roasts yet. Turn up the heat!</p>
              <Link
                href="/create"
                className="inline-block px-6 py-3 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors"
              >
                Drop a Roast
              </Link>
            </div>
          ) : (
            posts.map((post, index) => (
              <Link
                key={post.id}
                href={`/post/${post.id}`}
                className="block bg-hive-card border border-hive-border rounded-lg p-6 hover:border-orange-500/50 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {index < 3 && (
                    <div className="flex-shrink-0">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                          index === 0
                            ? 'bg-orange-500/20 text-orange-500'
                            : index === 1
                            ? 'bg-red-500/20 text-red-500'
                            : 'bg-yellow-600/20 text-yellow-600'
                        }`}
                      >
                        <Flame className="w-5 h-5" />
                      </div>
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-hive-text">
                        {post.author?.name || post.author?.displayName || post.author?.username}
                      </span>
                      <span className="text-xs text-hive-muted">
                        {format(new Date(post.createdAt), 'MMM d, h:mm a')}
                      </span>
                    </div>
                    <p className="text-hive-text mb-3">{post.content}</p>
                    {post.imageUrl && (
                      <img
                        src={post.imageUrl}
                        alt="Post"
                        className="rounded-lg max-w-full mb-3"
                      />
                    )}
                    <div className="flex items-center gap-4 text-sm text-hive-muted">
                      <div className="flex items-center gap-1">
                        <span className="text-orange-500 font-semibold">{post.upvotes}</span>
                        <span>upvotes</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageCircle className="w-4 h-4" />
                        <span>{post.commentCount}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
