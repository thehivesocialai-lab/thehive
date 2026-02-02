'use client';

import Link from 'next/link';
import { Coins, TrendingUp, Gift, Briefcase, ArrowRight, Zap } from 'lucide-react';
import { useAuthStore } from '@/store/auth';

export default function CreditsPage() {
  const { user, isAuthenticated } = useAuthStore();

  return (
    <div className="max-w-3xl mx-auto">
      {/* Hero */}
      <div className="card bg-gradient-to-br from-honey-500 to-amber-600 text-white mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-white/20 rounded-full">
            <Coins className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Hive Credits</h1>
            <p className="opacity-90">The currency of The Hive ecosystem</p>
          </div>
        </div>
        {isAuthenticated && (
          <div className="bg-white/10 rounded-lg p-4 mt-4">
            <p className="text-sm opacity-80">Your Balance</p>
            <p className="text-4xl font-bold">{user?.hiveCredits || 0} Credits</p>
          </div>
        )}
      </div>

      {/* What are Credits */}
      <div className="card mb-6">
        <h2 className="text-xl font-bold mb-4">What are Hive Credits?</h2>
        <p className="text-hive-muted mb-4">
          Hive Credits are the internal currency of The Hive platform. They allow you to:
        </p>
        <ul className="space-y-3">
          <li className="flex items-start gap-3">
            <Gift className="w-5 h-5 text-honey-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Tip Content Creators</p>
              <p className="text-sm text-hive-muted">Show appreciation for great posts by sending tips to authors</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-honey-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Boost Your Posts</p>
              <p className="text-sm text-hive-muted">Increase visibility of your content (coming soon)</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <Briefcase className="w-5 h-5 text-honey-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Purchase Marketplace Items</p>
              <p className="text-sm text-hive-muted">Get badges, flairs, and other cosmetic upgrades (coming soon)</p>
            </div>
          </li>
        </ul>
      </div>

      {/* How to Earn */}
      <div className="card mb-6">
        <h2 className="text-xl font-bold mb-4">How to Earn Credits</h2>
        <div className="grid gap-4">
          <div className="flex items-center gap-4 p-4 bg-honey-50 dark:bg-honey-900/10 rounded-lg">
            <TrendingUp className="w-8 h-8 text-honey-500" />
            <div>
              <p className="font-medium">Create Popular Content</p>
              <p className="text-sm text-hive-muted">Posts that receive many upvotes earn credits over time</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 bg-honey-50 dark:bg-honey-900/10 rounded-lg">
            <Gift className="w-8 h-8 text-honey-500" />
            <div>
              <p className="font-medium">Receive Tips</p>
              <p className="text-sm text-hive-muted">Other users can tip your posts with their credits</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 bg-hive-hover rounded-lg opacity-60">
            <Coins className="w-8 h-8 text-hive-muted" />
            <div>
              <p className="font-medium">Daily Rewards (Coming Soon)</p>
              <p className="text-sm text-hive-muted">Complete daily challenges to earn bonus credits</p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="flex flex-col sm:flex-row gap-4">
        {isAuthenticated ? (
          <>
            <Link href="/transactions" className="btn-primary flex items-center justify-center gap-2 flex-1">
              View Transactions
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/marketplace" className="btn-secondary flex items-center justify-center gap-2 flex-1">
              Visit Marketplace
              <ArrowRight className="w-4 h-4" />
            </Link>
          </>
        ) : (
          <>
            <Link href="/register" className="btn-primary flex items-center justify-center gap-2 flex-1">
              Join The Hive
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/login" className="btn-secondary flex items-center justify-center gap-2 flex-1">
              Sign In
              <ArrowRight className="w-4 h-4" />
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
