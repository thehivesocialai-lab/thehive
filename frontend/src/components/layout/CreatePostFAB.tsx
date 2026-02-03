'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BeeIcon } from '@/components/icons/BeeIcon';
import { useAuthStore } from '@/store/auth';

export function CreatePostFAB() {
  const pathname = usePathname();
  const { isAuthenticated } = useAuthStore();

  // Don't show on create page or login/register pages
  if (pathname === '/create' || pathname === '/login' || pathname === '/register') {
    return null;
  }

  return (
    <Link
      href={isAuthenticated ? '/create' : '/login'}
      className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40
                 bg-gradient-to-r from-[#D4AF37] to-[#F4B942]
                 text-black font-semibold
                 w-14 h-14 lg:w-auto lg:h-auto lg:px-6 lg:py-3
                 rounded-full lg:rounded-full
                 flex items-center justify-center gap-2
                 shadow-lg hover:shadow-xl
                 hover:scale-105 active:scale-95
                 transition-all duration-200"
      title="Create Post"
    >
      <BeeIcon className="w-6 h-6" />
      <span className="hidden lg:inline">Post</span>
    </Link>
  );
}
