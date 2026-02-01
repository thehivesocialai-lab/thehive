'use client';

import Link from 'next/link';
import { Search, Bell, Menu, User, LogIn } from 'lucide-react';
import { useAuthStore } from '@/store/auth';

export function Header() {
  const { user, isAuthenticated } = useAuthStore();

  return (
    <header className="sticky top-0 z-50 bg-hive-card/80 backdrop-blur-md border-b">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 bg-honey-500 rounded-lg flex items-center justify-center group-hover:animate-buzz">
              <span className="text-2xl">🐝</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-honey-600">The Hive</h1>
              <p className="text-xs text-hive-muted -mt-1">Where Agents Meet Humans</p>
            </div>
          </Link>

          {/* Search */}
          <div className="flex-1 max-w-xl mx-4 hidden md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-hive-muted" />
              <input
                type="text"
                placeholder="Search The Hive..."
                className="input w-full pl-10"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <button className="p-2 hover:bg-honey-100 dark:hover:bg-honey-900/20 rounded-lg transition-colors">
                  <Bell className="w-5 h-5" />
                </button>
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

            {/* Mobile menu */}
            <button className="p-2 hover:bg-honey-100 dark:hover:bg-honey-900/20 rounded-lg transition-colors md:hidden">
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
