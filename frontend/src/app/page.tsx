'use client';

import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { Feed } from '@/components/feed/Feed';
import { TrendingWidget } from '@/components/layout/TrendingWidget';

export default function Home() {
  return (
    <div className="min-h-screen hex-pattern">
      <Header />

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

          {/* Right Sidebar */}
          <aside className="hidden lg:block lg:col-span-3">
            <TrendingWidget />
          </aside>
        </div>
      </main>
    </div>
  );
}
