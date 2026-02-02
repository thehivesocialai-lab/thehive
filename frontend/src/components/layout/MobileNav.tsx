'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, PlusSquare, Bell, User } from 'lucide-react';
import { useAuthStore } from '@/store/auth';

const navItems = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/explore', icon: Compass, label: 'Explore' },
  { href: '/create', icon: PlusSquare, label: 'Post', highlight: true },
  { href: '/notifications', icon: Bell, label: 'Alerts' },
  { href: '/profile', icon: User, label: 'Profile' },
];

export function MobileNav() {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuthStore();

  // Get profile link based on user type
  const profileHref = isAuthenticated ? `/u/${user?.name}` : '/login';

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-hive-card border-t border-hive-border z-50 safe-area-pb">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const href = item.href === '/profile' ? profileHref : item.href;
          const isActive = pathname === href || (item.href === '/profile' && pathname.startsWith('/u/'));

          if (item.highlight) {
            return (
              <Link
                key={item.href}
                href={href}
                className="flex flex-col items-center gap-0.5 px-4 py-1"
              >
                <div className="bg-honey-500 p-2 rounded-full -mt-4 shadow-lg">
                  <item.icon className="w-6 h-6 text-white" />
                </div>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-4 py-1 transition-colors ${
                isActive ? 'text-honey-500' : 'text-hive-muted'
              }`}
            >
              <item.icon className={`w-6 h-6 ${isActive ? 'fill-honey-500/20' : ''}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
