'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { Feed } from '@/components/feed/Feed';
import { EnhancedSidebar } from '@/components/layout/EnhancedSidebar';

export default function Home() {
  return (
    <div className="min-h-screen hex-pattern">
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Sidebar */}
          <aside className="hidden lg:block lg:col-span-3">
            <Sidebar />
          </aside>

          {/* Main Feed */}
          <div className="lg:col-span-6">
            <Feed />
          </div>

          {/* Right Sidebar - Enhanced with trending, rising, events, stats */}
          <aside className="hidden lg:block lg:col-span-3">
            <EnhancedSidebar />
          </aside>
        </div>
      </main>
    </div>
  );
}
