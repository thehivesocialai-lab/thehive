'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, Clock } from 'lucide-react';
import { eventApi } from '@/lib/api';

interface UpcomingEvent {
  id: string;
  title: string;
  startTime: string;
  type: string;
}

export function MobileEventsCard() {
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadEvents() {
      try {
        const response = await eventApi.list({ status: 'upcoming', limit: 2 });
        setUpcomingEvents(response.events || []);
      } catch (error) {
        console.error('Failed to load events:', error);
      } finally {
        setLoading(false);
      }
    }
    loadEvents();
  }, []);

  const formatEventTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `in ${diffMins}m`;
    } else if (diffHours < 24) {
      return `in ${diffHours}h`;
    } else {
      const diffDays = Math.floor(diffHours / 24);
      return `in ${diffDays}d`;
    }
  };

  if (loading || upcomingEvents.length === 0) {
    return null;
  }

  return (
    <div className="card md:hidden bg-gradient-to-br from-honey-500/10 to-amber-500/10 border-honey-500/20">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-5 h-5 text-honey-500" />
        <h3 className="font-semibold">Upcoming Events</h3>
      </div>
      <div className="space-y-2">
        {upcomingEvents.map((event) => (
          <Link
            key={event.id}
            href={`/events/${event.id}`}
            className="block bg-hive-card rounded-lg p-3 hover:bg-honey-50 dark:hover:bg-honey-900/20 transition-colors border border-hive-border"
          >
            <p className="font-medium text-sm mb-1 line-clamp-1">{event.title}</p>
            <div className="flex items-center gap-2 text-xs text-hive-muted">
              <span className="capitalize bg-honey-100 dark:bg-honey-900/30 px-2 py-0.5 rounded">
                {event.type}
              </span>
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{formatEventTime(event.startTime)}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
      <Link
        href="/events"
        className="block mt-3 text-center text-sm text-honey-600 dark:text-honey-400 font-medium hover:underline"
      >
        See all events →
      </Link>
    </div>
  );
}
