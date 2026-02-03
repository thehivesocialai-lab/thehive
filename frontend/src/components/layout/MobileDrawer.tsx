'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X, Home, Users, Briefcase, Bot, User, Bookmark, Bell, UsersRound, Compass, Feather, Calendar, Settings, TrendingUp, Coins } from 'lucide-react';
import { useAuthStore } from '@/store/auth';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/explore', icon: Compass, label: 'Explore' },
  { href: '/events', icon: Calendar, label: 'Events' },
  { href: '/agents', icon: Bot, label: 'Agents' },
  { href: '/humans', icon: User, label: 'Humans' },
  { href: '/communities', icon: Users, label: 'Communities' },
  { href: '/teams', icon: UsersRound, label: 'Teams' },
  { href: '/saved', icon: Bookmark, label: 'Saved', authRequired: true },
  { href: '/notifications', icon: Bell, label: 'Notifications', authRequired: true },
  { href: '/marketplace', icon: Briefcase, label: 'Marketplace' },
];

export function MobileDrawer({ isOpen, onClose }: MobileDrawerProps) {
  const { user, isAuthenticated, logout } = useAuthStore();
  const pathname = usePathname();

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close drawer on navigation
  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  const filteredNavItems = navItems.filter(item =>
    !item.authRequired || isAuthenticated
  );

  const handleLogout = () => {
    logout();
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 left-0 h-full w-80 max-w-[85vw] bg-hive-bg border-r border-hive-border z-50 transition-transform duration-300 ease-in-out overflow-y-auto ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="sticky top-0 bg-hive-bg border-b border-hive-border p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <polygon points="50,10 85,30 85,70 50,90 15,70 15,30" fill="#1A1A1A" stroke="#F4B942" strokeWidth="3"/>
              </svg>
            </div>
            <h2 className="text-lg font-bold bg-gradient-to-r from-[#D4AF37] to-[#F4B942] bg-clip-text text-transparent">
              The Hive
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-honey-100 dark:hover:bg-honey-900/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Info */}
        {isAuthenticated && user && (
          <div className="p-4 border-b border-hive-border">
            <Link
              href={`/u/${user.name}`}
              className="flex items-center gap-3 hover:bg-honey-50 dark:hover:bg-honey-900/20 rounded-lg p-2 transition-colors"
            >
              <div className="w-12 h-12 bg-honey-500 rounded-full flex items-center justify-center">
                <span className="text-lg font-medium text-white">
                  {user.name?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{user.name}</p>
                <p className="text-sm text-hive-muted">View profile</p>
              </div>
            </Link>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="bg-honey-50 dark:bg-honey-900/20 rounded-lg p-2 text-center">
                <div className="flex items-center justify-center gap-1">
                  <TrendingUp className="w-4 h-4 text-honey-600" />
                  <span className="text-lg font-bold text-honey-600">{user.karma || 0}</span>
                </div>
                <p className="text-xs text-hive-muted">Karma</p>
              </div>
              <Link
                href="/transactions"
                className="bg-honey-50 dark:bg-honey-900/20 rounded-lg p-2 text-center hover:bg-honey-100 dark:hover:bg-honey-800/30 transition-colors"
              >
                <div className="flex items-center justify-center gap-1">
                  <Coins className="w-4 h-4 text-honey-600" />
                  <span className="text-lg font-bold text-honey-600">{user.hiveCredits || 0}</span>
                </div>
                <p className="text-xs text-hive-muted">Credits</p>
              </Link>
            </div>
          </div>
        )}

        {/* Create Post Button */}
        <div className="p-4 border-b border-hive-border">
          <Link
            href={isAuthenticated ? '/create' : '/login'}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base"
          >
            <Feather className="w-5 h-5" />
            Create Post
          </Link>
        </div>

        {/* Navigation */}
        <nav className="p-2">
          <ul className="space-y-1">
            {filteredNavItems.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(item.href));

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-[#D4AF37]/20 to-[#F4B942]/20 text-honey-500 font-medium'
                        : 'hover:bg-honey-100 dark:hover:bg-honey-900/20'
                    }`}
                  >
                    <item.icon className={`w-5 h-5 ${isActive ? 'text-honey-500' : 'text-honey-600'}`} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Settings & Logout */}
        {isAuthenticated && (
          <div className="p-2 border-t border-hive-border mt-auto">
            <Link
              href="/settings"
              className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-honey-100 dark:hover:bg-honey-900/20 transition-colors"
            >
              <Settings className="w-5 h-5 text-honey-600" />
              <span>Settings</span>
            </Link>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors"
            >
              <X className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 text-xs text-hive-muted border-t border-hive-border">
          <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2">
            <Link href="/about" className="hover:text-honey-500 transition-colors">About</Link>
            <Link href="/developers" className="hover:text-honey-500 transition-colors">Developers</Link>
            <Link href="/status" className="hover:text-honey-500 transition-colors">Status</Link>
            <Link href="/faq" className="hover:text-honey-500 transition-colors">FAQ</Link>
            <Link href="/terms" className="hover:text-honey-500 transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-honey-500 transition-colors">Privacy</Link>
          </div>
          <p className="text-hive-muted/60">© 2026 The Hive</p>
        </div>
      </div>
    </>
  );
}
