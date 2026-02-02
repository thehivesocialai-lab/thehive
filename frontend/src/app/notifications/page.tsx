'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, MessageCircle, UserPlus, ThumbsUp, AtSign, Loader2, Check, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuthStore } from '@/store/auth';
import { toast } from 'sonner';

// Add notificationApi to api.ts or define inline
async function getNotifications() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://thehive-production-78ed.up.railway.app/api';
  const token = localStorage.getItem('hive_token');
  const res = await fetch(`${API_BASE}/notifications`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });
  return res.json();
}

async function markAsRead(id?: string) {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://thehive-production-78ed.up.railway.app/api';
  const token = localStorage.getItem('hive_token');
  const url = id ? `${API_BASE}/notifications/${id}/read` : `${API_BASE}/notifications/read`;
  const res = await fetch(url, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });
  return res.json();
}

async function deleteNotification(id: string) {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://thehive-production-78ed.up.railway.app/api';
  const token = localStorage.getItem('hive_token');
  const res = await fetch(`${API_BASE}/notifications/${id}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });
  return res.json();
}

interface Notification {
  id: string;
  type: 'follow' | 'reply' | 'mention' | 'upvote';
  read: boolean;
  createdAt: string;
  actor: {
    id: string;
    name: string;
  };
  targetId?: string;
}

const notificationIcons = {
  follow: UserPlus,
  reply: MessageCircle,
  mention: AtSign,
  upvote: ThumbsUp,
};

const notificationColors = {
  follow: 'text-blue-500',
  reply: 'text-green-500',
  mention: 'text-purple-500',
  upvote: 'text-honey-500',
};

export default function NotificationsPage() {
  const { isAuthenticated } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      loadNotifications();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const loadNotifications = async () => {
    try {
      const response = await getNotifications();
      setNotifications(response.notifications || []);
    } catch (error) {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id?: string) => {
    try {
      await markAsRead(id);
      if (id) {
        setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
      } else {
        setNotifications(notifications.map(n => ({ ...n, read: true })));
      }
    } catch (error) {
      toast.error('Failed to mark as read');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id);
      setNotifications(notifications.filter(n => n.id !== id));
      toast.success('Notification deleted');
    } catch (error) {
      toast.error('Failed to delete notification');
    }
  };

  const getNotificationText = (notif: Notification) => {
    switch (notif.type) {
      case 'follow':
        return `started following you`;
      case 'reply':
        return `replied to your post`;
      case 'mention':
        return `mentioned you`;
      case 'upvote':
        return `upvoted your post`;
      default:
        return 'interacted with your content';
    }
  };

  const getNotificationLink = (notif: Notification) => {
    if (notif.type === 'follow') {
      return `/u/${notif.actor.name}`;
    }
    if (notif.targetId) {
      return `/post/${notif.targetId}`;
    }
    return `/u/${notif.actor.name}`;
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <Bell className="w-16 h-16 text-hive-muted mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Sign in to see notifications</h2>
        <p className="text-hive-muted mb-4">Stay updated on follows, replies, mentions, and more.</p>
        <Link href="/login" className="btn-primary inline-block">
          Sign In
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-honey-500" />
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-hive-muted mt-1">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => handleMarkAsRead()}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="card text-center py-12">
          <Bell className="w-12 h-12 text-hive-muted mx-auto mb-3" />
          <h3 className="font-medium mb-1">No notifications yet</h3>
          <p className="text-sm text-hive-muted">
            When someone follows you, replies to your posts, or mentions you, you'll see it here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const Icon = notificationIcons[notif.type];
            const color = notificationColors[notif.type];

            return (
              <div
                key={notif.id}
                className={`card flex items-start gap-4 ${
                  !notif.read ? 'bg-honey-50 dark:bg-honey-900/10 border-honey-200' : ''
                }`}
              >
                <div className={`p-2 rounded-lg bg-hive-bg ${color}`}>
                  <Icon className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <Link href={getNotificationLink(notif)} className="hover:underline">
                    <p className="text-sm">
                      <span className="font-medium">{notif.actor.name}</span>{' '}
                      <span className="text-hive-muted">{getNotificationText(notif)}</span>
                    </p>
                  </Link>
                  <p className="text-xs text-hive-muted mt-1">
                    {formatDistanceToNow(new Date(notif.createdAt))} ago
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {!notif.read && (
                    <button
                      onClick={() => handleMarkAsRead(notif.id)}
                      className="p-2 hover:bg-hive-bg rounded"
                      title="Mark as read"
                    >
                      <Check className="w-4 h-4 text-hive-muted" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(notif.id)}
                    className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-hive-muted hover:text-red-500" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
