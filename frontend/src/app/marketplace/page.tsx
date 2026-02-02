'use client';

import { Briefcase, Zap, Gift, Star, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';

export default function MarketplacePage() {
  const { user, isAuthenticated } = useAuthStore();

  const items = [
    {
      id: 'boost-post',
      name: 'Post Boost',
      description: 'Boost your post to the top of the feed for 24 hours',
      price: 50,
      icon: Zap,
      color: 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30',
      available: false,
    },
    {
      id: 'premium-badge',
      name: 'Premium Badge',
      description: 'Show off a premium badge on your profile for 30 days',
      price: 100,
      icon: Star,
      color: 'text-purple-500 bg-purple-100 dark:bg-purple-900/30',
      available: false,
    },
    {
      id: 'custom-flair',
      name: 'Custom Flair',
      description: 'Add a custom flair next to your username',
      price: 75,
      icon: Sparkles,
      color: 'text-pink-500 bg-pink-100 dark:bg-pink-900/30',
      available: false,
    },
    {
      id: 'gift-credits',
      name: 'Gift Credits',
      description: 'Send credits to another user as a gift',
      price: 0,
      icon: Gift,
      color: 'text-green-500 bg-green-100 dark:bg-green-900/30',
      available: false,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Briefcase className="w-8 h-8 text-honey-500" />
        <div>
          <h1 className="text-2xl font-bold">Marketplace</h1>
          <p className="text-hive-muted">Spend your Hive Credits on upgrades and boosts</p>
        </div>
      </div>

      {/* Credits Balance */}
      {isAuthenticated && (
        <div className="card mb-6 bg-gradient-to-r from-honey-500 to-amber-500 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-80">Your Balance</p>
              <p className="text-3xl font-bold">{user?.hiveCredits || 0} Credits</p>
            </div>
            <Link href="/transactions" className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg font-medium transition-colors">
              View History
            </Link>
          </div>
        </div>
      )}

      {/* Coming Soon Notice */}
      <div className="card mb-6 border-honey-400 bg-honey-50 dark:bg-honey-900/10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-honey-100 dark:bg-honey-900/30 rounded-full">
            <Sparkles className="w-5 h-5 text-honey-600" />
          </div>
          <div>
            <h3 className="font-semibold">Marketplace Coming Soon</h3>
            <p className="text-sm text-hive-muted">
              We&apos;re working on exciting items you can purchase with your Hive Credits.
              For now, you can earn and tip credits on posts!
            </p>
          </div>
        </div>
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((item) => (
          <div key={item.id} className="card relative overflow-hidden">
            {!item.available && (
              <div className="absolute top-2 right-2 bg-hive-muted text-white text-xs px-2 py-1 rounded-full">
                Coming Soon
              </div>
            )}
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-lg ${item.color}`}>
                <item.icon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">{item.name}</h3>
                <p className="text-sm text-hive-muted mb-3">{item.description}</p>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-honey-600">
                    {item.price > 0 ? `${item.price} Credits` : 'Free'}
                  </span>
                  <button
                    disabled={!item.available}
                    className="btn-primary btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {item.available ? 'Purchase' : 'Soon'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* How to Earn */}
      <div className="card mt-6">
        <h3 className="font-semibold mb-4">How to Earn Credits</h3>
        <ul className="space-y-3 text-sm text-hive-muted">
          <li className="flex items-center gap-3">
            <div className="w-2 h-2 bg-honey-500 rounded-full"></div>
            Post quality content that gets upvoted
          </li>
          <li className="flex items-center gap-3">
            <div className="w-2 h-2 bg-honey-500 rounded-full"></div>
            Receive tips from other users
          </li>
          <li className="flex items-center gap-3">
            <div className="w-2 h-2 bg-honey-500 rounded-full"></div>
            Complete daily challenges (coming soon)
          </li>
          <li className="flex items-center gap-3">
            <div className="w-2 h-2 bg-honey-500 rounded-full"></div>
            Refer new users to The Hive (coming soon)
          </li>
        </ul>
      </div>
    </div>
  );
}
