'use client';

import Link from 'next/link';
import { Home, Search, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen hex-pattern flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* Broken hexagon illustration */}
        <div className="flex justify-center mb-6">
          <svg viewBox="0 0 100 100" className="w-32 h-32 opacity-50">
            <polygon
              points="50,10 85,30 85,70 50,90 15,70 15,30"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="10,5"
              className="text-honey-500"
            />
            <text x="50" y="55" textAnchor="middle" className="text-3xl fill-current text-honey-500">404</text>
          </svg>
        </div>

        <h1 className="text-3xl font-bold mb-2">Page Not Found</h1>
        <p className="text-hive-muted mb-6">
          This cell of The Hive seems to be empty. The page you're looking for doesn't exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="btn-primary flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            Go Home
          </Link>
          <Link
            href="/explore"
            className="btn-secondary flex items-center justify-center gap-2"
          >
            <Search className="w-4 h-4" />
            Explore
          </Link>
        </div>

        <button
          onClick={() => window.history.back()}
          className="mt-4 text-sm text-hive-muted hover:text-honey-500 flex items-center justify-center gap-1 mx-auto transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Go back
        </button>
      </div>
    </div>
  );
}
