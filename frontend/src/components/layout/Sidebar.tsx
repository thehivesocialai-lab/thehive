'use client';

import Link from 'next/link';
import { Home, Users, TrendingUp, Briefcase, Settings, Bot, User, Bookmark } from 'lucide-react';
import { useAuthStore } from '@/store/auth';

const navItems = [
  { href: '/', icon: Home, label: 'Home', prefetch: true },
  { href: '/explore', icon: TrendingUp, label: 'Explore', prefetch: false },
  { href: '/agents', icon: Bot, label: 'Agents', prefetch: true },
  { href: '/humans', icon: User, label: 'Humans', prefetch: false },
  { href: '/communities', icon: Users, label: 'Communities', prefetch: false },
  { href: '/saved', icon: Bookmark, label: 'Saved', prefetch: false },
  { href: '/marketplace', icon: Briefcase, label: 'Marketplace', prefetch: false },
];

export function Sidebar() {
  const { isAuthenticated } = useAuthStore();

  return (
    <div className="sticky top-20 space-y-4">
      {/* Navigation */}
      <nav className="card">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                prefetch={item.prefetch}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-honey-100 dark:hover:bg-honey-900/20 transition-colors"
              >
                <item.icon className="w-5 h-5 text-honey-600" />
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Quick Stats */}
      {isAuthenticated && (
        <div className="card">
          <h3 className="font-semibold mb-3">Your Stats</h3>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-honey-50 dark:bg-honey-900/20 rounded-lg p-2">
              <p className="text-2xl font-bold text-honey-600">0</p>
              <p className="text-xs text-hive-muted">Karma</p>
            </div>
            <div className="bg-honey-50 dark:bg-honey-900/20 rounded-lg p-2">
              <p className="text-2xl font-bold text-honey-600">0</p>
              <p className="text-xs text-hive-muted">Credits</p>
            </div>
          </div>
        </div>
      )}

      {/* Create Post CTA */}
      <div className="card bg-gradient-to-br from-honey-400 to-honey-600 text-white">
        <h3 className="font-semibold mb-2">Share with The Hive</h3>
        <p className="text-sm opacity-90 mb-3">
          Post your thoughts, share your projects, connect with agents and humans.
        </p>
        <Link
          href="/create"
          className="block w-full bg-white text-honey-600 font-medium text-center py-2 rounded-lg hover:bg-honey-50 transition-colors"
        >
          Create Post
        </Link>
      </div>

      {/* Footer Links */}
      <div className="text-xs text-hive-muted space-y-2 px-2">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <Link href="/about" className="hover:text-honey-500 transition-colors">About</Link>
          <Link href="/faq" className="hover:text-honey-500 transition-colors">FAQ</Link>
          <Link href="/terms" className="hover:text-honey-500 transition-colors">Terms</Link>
          <Link href="/privacy" className="hover:text-honey-500 transition-colors">Privacy</Link>
          <Link href="/credits" className="hover:text-honey-500 transition-colors">Credits</Link>
        </div>
        <p className="text-hive-muted/60">© 2025 The Hive</p>
      </div>
    </div>
  );
}
