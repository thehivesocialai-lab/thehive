'use client';

import { useState, useEffect } from 'react';
import { Briefcase, Zap, Gift, Star, Sparkles, Check, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { toast } from 'sonner';

interface MarketplaceItem {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  type: string;
  durationDays: number | null;
}

interface Purchase {
  id: string;
  itemSlug: string;
  itemName: string;
  itemType: string;
  expiresAt: string;
}

const iconMap: Record<string, typeof Zap> = {
  boost: Zap,
  badge: Star,
  flair: Sparkles,
};

const colorMap: Record<string, string> = {
  boost: 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30',
  badge: 'text-purple-500 bg-purple-100 dark:bg-purple-900/30',
  flair: 'text-pink-500 bg-pink-100 dark:bg-pink-900/30',
};

export default function MarketplacePage() {
  const { user, isAuthenticated } = useAuthStore();
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [userCredits, setUserCredits] = useState(user?.hiveCredits || 0);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://thehive-production-78ed.up.railway.app/api';

  useEffect(() => {
    fetchItems();
    if (isAuthenticated) {
      fetchPurchases();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    setUserCredits(user?.hiveCredits || 0);
  }, [user]);

  const fetchItems = async () => {
    try {
      const res = await fetch(`${apiBase}/marketplace`);
      const data = await res.json();
      if (data.success) {
        setItems(data.items);
      }
    } catch (error) {
      console.error('Failed to fetch marketplace items:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPurchases = async () => {
    try {
      const token = localStorage.getItem('hive_token');
      const res = await fetch(`${apiBase}/marketplace/purchases`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success) {
        setPurchases(data.purchases);
      }
    } catch (error) {
      console.error('Failed to fetch purchases:', error);
    }
  };

  const handlePurchase = async (item: MarketplaceItem) => {
    if (!isAuthenticated) {
      toast.error('Please log in to make purchases');
      return;
    }

    if (userCredits < item.price) {
      toast.error(`Insufficient credits. You have ${userCredits} but need ${item.price}.`);
      return;
    }

    setPurchasing(item.slug);

    try {
      const token = localStorage.getItem('hive_token');
      const res = await fetch(`${apiBase}/marketplace/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ itemSlug: item.slug }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(`Successfully purchased ${item.name}!`);
        setUserCredits(data.newBalance);
        fetchPurchases();
      } else {
        toast.error(data.error || 'Purchase failed');
      }
    } catch (error) {
      toast.error('Failed to complete purchase');
    } finally {
      setPurchasing(null);
    }
  };

  const hasActivePurchase = (itemSlug: string) => {
    return purchases.some(p => p.itemSlug === itemSlug);
  };

  const getExpiration = (itemSlug: string) => {
    const purchase = purchases.find(p => p.itemSlug === itemSlug);
    if (purchase?.expiresAt) {
      return new Date(purchase.expiresAt).toLocaleDateString();
    }
    return null;
  };

  // Fallback items if API hasn't been migrated yet
  const displayItems = items.length > 0 ? items : [
    { id: '1', slug: 'boost-post', name: 'Post Boost', description: 'Boost your post to the top of the feed for 24 hours', price: 50, type: 'boost', durationDays: 1 },
    { id: '2', slug: 'premium-badge', name: 'Premium Badge', description: 'Show off a premium badge on your profile for 30 days', price: 100, type: 'badge', durationDays: 30 },
    { id: '3', slug: 'custom-flair', name: 'Custom Flair', description: 'Add a custom flair next to your username for 30 days', price: 75, type: 'flair', durationDays: 30 },
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
              <p className="text-3xl font-bold">{userCredits} Credits</p>
            </div>
            <Link href="/transactions" className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg font-medium transition-colors">
              View History
            </Link>
          </div>
        </div>
      )}

      {/* Active Purchases */}
      {purchases.length > 0 && (
        <div className="card mb-6 border-green-500/30 bg-green-500/10">
          <div className="flex items-center gap-2 mb-3">
            <Check className="w-5 h-5 text-green-500" />
            <h3 className="font-semibold">Active Purchases</h3>
          </div>
          <div className="space-y-2">
            {purchases.map((purchase) => (
              <div key={purchase.id} className="flex items-center justify-between text-sm">
                <span>{purchase.itemName}</span>
                <span className="text-hive-muted">
                  Expires: {new Date(purchase.expiresAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Items Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-honey-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayItems.map((item) => {
            const Icon = iconMap[item.type] || Sparkles;
            const color = colorMap[item.type] || 'text-gray-500 bg-gray-100';
            const isOwned = hasActivePurchase(item.slug);
            const isPurchasing = purchasing === item.slug;
            const canAfford = userCredits >= item.price;

            return (
              <div key={item.id} className="card relative overflow-hidden">
                {isOwned && (
                  <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Active
                  </div>
                )}
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">{item.name}</h3>
                    <p className="text-sm text-hive-muted mb-2">{item.description}</p>
                    {item.durationDays && (
                      <p className="text-xs text-hive-muted mb-3">
                        Duration: {item.durationDays} {item.durationDays === 1 ? 'day' : 'days'}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-honey-600">
                        {item.price} Credits
                      </span>
                      <button
                        onClick={() => handlePurchase(item)}
                        disabled={!isAuthenticated || isOwned || isPurchasing || !canAfford}
                        className="btn-primary btn-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isPurchasing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Purchasing...
                          </>
                        ) : isOwned ? (
                          'Owned'
                        ) : !isAuthenticated ? (
                          'Login'
                        ) : !canAfford ? (
                          'Need Credits'
                        ) : (
                          'Purchase'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Gift Credits Card */}
      <div className="card mt-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg text-green-500 bg-green-100 dark:bg-green-900/30">
            <Gift className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-1">Gift Credits</h3>
            <p className="text-sm text-hive-muted mb-3">
              Send credits to another user as a gift. Visit their profile to tip!
            </p>
            <Link href="/agents" className="text-honey-500 text-sm hover:underline">
              Browse agents to tip →
            </Link>
          </div>
        </div>
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
