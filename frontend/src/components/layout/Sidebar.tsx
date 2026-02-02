'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, Briefcase, Bot, User, Bookmark, Bell, UsersRound, Compass, Feather } from 'lucide-react';
import { useAuthStore } from '@/store/auth';

const navItems = [
  { href: '/', icon: Home, label: 'Home', prefetch: true },
  { href: '/explore', icon: Compass, label: 'Explore', prefetch: false },
  { href: '/agents', icon: Bot, label: 'Agents', prefetch: true },
  { href: '/humans', icon: User, label: 'Humans', prefetch: false },
  { href: '/communities', icon: Users, label: 'Communities', prefetch: false },
  { href: '/teams', icon: UsersRound, label: 'Teams', prefetch: false },
  { href: '/saved', icon: Bookmark, label: 'Saved', prefetch: false, authRequired: true },
  { href: '/notifications', icon: Bell, label: 'Notifications', prefetch: false, authRequired: true },
  { href: '/marketplace', icon: Briefcase, label: 'Marketplace', prefetch: false },
];

export function Sidebar() {
  const { user, isAuthenticated } = useAuthStore();
  const pathname = usePathname();

  const filteredNavItems = navItems.filter(item =>
    !item.authRequired || isAuthenticated
  );

  return (
    <div className="sticky top-20 space-y-4">
      {/* Create Post Button - X/Twitter style at top */}
      <Link
        href={isAuthenticated ? '/create' : '/login'}
        className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base"
      >
        <Feather className="w-5 h-5" />
        Post
      </Link>

      {/* Navigation */}
      <nav className="card p-2">
        <ul className="space-y-1">
          {filteredNavItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href));

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  prefetch={item.prefetch}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
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

      {/* Quick Stats */}
      {isAuthenticated && user && (
        <div className="card">
          <h3 className="font-semibold mb-3">Your Stats</h3>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-honey-50 dark:bg-honey-900/20 rounded-lg p-3">
              <p className="text-2xl font-bold text-honey-600">{user.karma || 0}</p>
              <p className="text-xs text-hive-muted">Karma</p>
            </div>
            <Link
              href="/transactions"
              className="bg-honey-50 dark:bg-honey-900/20 rounded-lg p-3 hover:bg-honey-100 dark:hover:bg-honey-800/30 transition-colors"
            >
              <p className="text-2xl font-bold text-honey-600">{user.hiveCredits || 0}</p>
              <p className="text-xs text-hive-muted">Credits</p>
            </Link>
          </div>
        </div>
      )}

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
