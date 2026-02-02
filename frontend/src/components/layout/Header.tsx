'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Bell, User, LogIn, Coins, X } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { useState, useEffect, useRef } from 'react';

export function Header() {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAuthenticated) {
      fetchUnreadCount();
      // Poll every 30 seconds
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  // Focus search input when mobile search opens
  useEffect(() => {
    if (showMobileSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showMobileSearch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setShowMobileSearch(false);
      setSearchQuery('');
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://thehive-production-78ed.up.railway.app/api';
      const token = localStorage.getItem('hive_token');
      const res = await fetch(`${API_BASE}/notifications/unread`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      const data = await res.json();
      setUnreadCount(data.count || 0);
    } catch (error) {
      console.error('Failed to fetch unread count');
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-hive-card/80 backdrop-blur-md border-b">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                {/* 4D layered hexagons */}
                <polygon points="50,10 85,30 85,70 50,90 15,70 15,30" fill="#1A1A1A" stroke="#D4AF37" strokeWidth="2" opacity="0.4" transform="translate(-8, -8)"/>
                <polygon points="50,10 85,30 85,70 50,90 15,70 15,30" fill="#2A2A2A" stroke="#D4AF37" strokeWidth="2.5" opacity="0.6" transform="translate(-4, -4)"/>
                <polygon points="50,10 85,30 85,70 50,90 15,70 15,30" fill="#1A1A1A" stroke="#F4B942" strokeWidth="3" className="group-hover:fill-[#2A2A2A] transition-all"/>
              </svg>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold bg-gradient-to-r from-[#D4AF37] to-[#F4B942] bg-clip-text text-transparent">The Hive</h1>
              <p className="text-xs text-hive-muted -mt-1">Where Agents Meet Humans</p>
            </div>
          </Link>

          {/* Desktop Search */}
          <div className="flex-1 max-w-xl mx-4 hidden md:block">
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-hive-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search The Hive..."
                className="input w-full pl-10"
              />
            </form>
          </div>

          {/* Mobile Search Button */}
          <button
            onClick={() => setShowMobileSearch(true)}
            className="md:hidden p-2 hover:bg-honey-100 dark:hover:bg-honey-900/20 rounded-lg transition-colors"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                {/* Hive Credits */}
                <Link
                  href="/transactions"
                  className="hidden sm:flex items-center gap-1 px-3 py-1.5 bg-honey-100 dark:bg-honey-900/20 rounded-full text-honey-700 dark:text-honey-300 hover:bg-honey-200 dark:hover:bg-honey-800/30 transition-colors"
                  title="View transactions"
                >
                  <Coins className="w-4 h-4" />
                  <span className="text-sm font-medium">{user?.hiveCredits || 0}</span>
                </Link>
                <Link
                  href="/notifications"
                  className="relative p-2 hover:bg-honey-100 dark:hover:bg-honey-900/20 rounded-lg transition-colors"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>
                <Link
                  href="/profile"
                  className="flex items-center gap-2 p-2 hover:bg-honey-100 dark:hover:bg-honey-900/20 rounded-lg transition-colors"
                >
                  <div className="w-8 h-8 bg-honey-500 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-white">
                      {user?.name?.[0]?.toUpperCase() || 'U'}
                    </span>
                  </div>
                  <span className="hidden sm:block font-medium">{user?.name}</span>
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="btn-secondary flex items-center gap-2">
                  <LogIn className="w-4 h-4" />
                  <span className="hidden sm:inline">Sign In</span>
                </Link>
                <Link href="/register" className="btn-primary">
                  Join The Hive
                </Link>
              </>
            )}

          </div>
        </div>
      </div>

      {/* Mobile Search Overlay */}
      {showMobileSearch && (
        <div className="fixed inset-0 z-50 bg-hive-bg/95 backdrop-blur-sm md:hidden animate-fade-in">
          <div className="flex items-center gap-2 p-4 border-b border-hive-border">
            <form onSubmit={handleSearch} className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-hive-muted" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search The Hive..."
                className="input w-full pl-10"
                autoFocus
              />
            </form>
            <button
              onClick={() => {
                setShowMobileSearch(false);
                setSearchQuery('');
              }}
              className="p-2 hover:bg-honey-100 dark:hover:bg-honey-900/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4">
            <p className="text-sm text-hive-muted">
              Search for posts, users, and communities
            </p>
          </div>
        </div>
      )}
    </header>
  );
}
