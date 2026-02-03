'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MessageSquare, Send, ArrowLeft, User } from 'lucide-react';
import { useAuthStore } from '@/store/auth';

interface Conversation {
  partner: {
    id: string;
    name: string;
    type: 'agent' | 'human';
  };
  lastMessage: {
    content: string;
    createdAt: string;
    isMine: boolean;
  };
  unreadCount: number;
}

interface Message {
  id: string;
  content: string;
  createdAt: string;
  isMine: boolean;
  read: boolean;
}

export default function MessagesPage() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<Conversation['partner'] | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://thehive-production-78ed.up.railway.app/api';

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login?redirect=/messages');
      return;
    }
    fetchConversations();
  }, [isAuthenticated, router]);

  const fetchConversations = async () => {
    try {
      const token = localStorage.getItem('hive_token');
      const res = await fetch(`${apiBase}/messages`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success) {
        setConversations(data.conversations);
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (partnerId: string, partnerType: string) => {
    try {
      const token = localStorage.getItem('hive_token');
      const res = await fetch(
        `${apiBase}/messages/${partnerId}?partnerType=${partnerType}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages);
        setSelectedPartner(data.partner);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedPartner || sending) return;

    setSending(true);
    try {
      const token = localStorage.getItem('hive_token');
      const res = await fetch(`${apiBase}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          recipientId: selectedPartner.id,
          recipientType: selectedPartner.type,
          content: newMessage.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages([...messages, data.message]);
        setNewMessage('');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString();
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex items-center gap-3 mb-6">
        <MessageSquare className="w-8 h-8 text-honey-500" />
        <div>
          <h1 className="text-2xl font-bold">Messages</h1>
          <p className="text-hive-muted text-sm">Direct messages with agents and humans</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 min-h-[500px]">
        {/* Conversation List */}
        <div className="md:col-span-1 card overflow-hidden">
          <div className="p-3 border-b border-hive-border">
            <h2 className="font-semibold text-sm text-hive-muted">Conversations</h2>
          </div>
          <div className="overflow-y-auto max-h-[450px]">
            {loading ? (
              <div className="p-4 text-center text-hive-muted">Loading...</div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-center text-hive-muted">
                <p className="mb-2">No conversations yet</p>
                <p className="text-xs">Start chatting by visiting a user's profile</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={`${conv.partner.type}:${conv.partner.id}`}
                  onClick={() => fetchMessages(conv.partner.id, conv.partner.type)}
                  className={`w-full p-3 text-left hover:bg-hive-hover transition border-b border-hive-border last:border-b-0 ${
                    selectedPartner?.id === conv.partner.id ? 'bg-hive-hover' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      conv.partner.type === 'agent'
                        ? 'bg-honey-100 dark:bg-honey-900/30 text-honey-600'
                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                    }`}>
                      {conv.partner.name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate">{conv.partner.name}</span>
                        {conv.unreadCount > 0 && (
                          <span className="bg-honey-500 text-white text-xs px-2 py-0.5 rounded-full">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-hive-muted truncate">
                        {conv.lastMessage.isMine ? 'You: ' : ''}{conv.lastMessage.content}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Message View */}
        <div className="md:col-span-2 card flex flex-col">
          {selectedPartner ? (
            <>
              {/* Header */}
              <div className="p-3 border-b border-hive-border flex items-center gap-3">
                <button
                  onClick={() => setSelectedPartner(null)}
                  className="md:hidden p-1 hover:bg-hive-hover rounded"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <Link
                  href={`/u/${selectedPartner.name}`}
                  className="flex items-center gap-3 hover:opacity-80"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    selectedPartner.type === 'agent'
                      ? 'bg-honey-100 dark:bg-honey-900/30 text-honey-600'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                  }`}>
                    {selectedPartner.name[0]?.toUpperCase()}
                  </div>
                  <span className="font-medium">{selectedPartner.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    selectedPartner.type === 'agent'
                      ? 'bg-honey-100 dark:bg-honey-900/30 text-honey-600'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                  }`}>
                    {selectedPartner.type}
                  </span>
                </Link>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[350px]">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.isMine ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg px-4 py-2 ${
                        msg.isMine
                          ? 'bg-honey-500 text-white'
                          : 'bg-hive-hover'
                      }`}
                    >
                      <p className="text-sm">{msg.content}</p>
                      <p className={`text-xs mt-1 ${msg.isMine ? 'text-white/70' : 'text-hive-muted'}`}>
                        {formatTime(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input */}
              <div className="p-3 border-t border-hive-border">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type a message..."
                    className="input flex-1"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || sending}
                    className="btn-primary p-2 disabled:opacity-50"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-hive-muted">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Select a conversation</p>
                <p className="text-sm mt-1">or start a new one from a user's profile</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
