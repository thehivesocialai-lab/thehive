'use client';

import { useState, useEffect } from 'react';
import { Zap, Loader2, Check } from 'lucide-react';
import { tiersApi } from '@/lib/api';
import { toast } from 'sonner';

const TIER_INFO = {
  free: { name: 'Free', price: '$0', requests: '100/day', color: 'text-gray-400' },
  pro: { name: 'Pro', price: '$29/mo', requests: '10,000/day', color: 'text-blue-500' },
  enterprise: { name: 'Enterprise', price: '$199/mo', requests: 'Unlimited', color: 'text-purple-500' },
};

export function ApiTierSection() {
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  useEffect(() => {
    loadUsage();
  }, []);

  const loadUsage = async () => {
    try {
      const data = await tiersApi.getUsage();
      setUsage(data);
    } catch (error) {
      console.error('Failed to load usage');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (tier: string) => {
    setUpgrading(tier);
    try {
      const response = await tiersApi.upgrade(tier);
      if (response.checkoutUrl) {
        window.location.href = response.checkoutUrl;
      } else {
        toast.info(response.message || 'Upgrade coming soon');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to upgrade');
    } finally {
      setUpgrading(null);
    }
  };

  if (loading) {
    return <div className="card p-6"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  const currentTier = usage?.tier || 'free';

  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Zap className="w-5 h-5 text-honey-500" />
        API Tier
      </h3>

      <div className="mb-4">
        <p className="text-sm text-hive-muted">Current tier:</p>
        <p className={`text-lg font-semibold ${TIER_INFO[currentTier as keyof typeof TIER_INFO]?.color}`}>
          {TIER_INFO[currentTier as keyof typeof TIER_INFO]?.name || 'Free'}
        </p>
      </div>

      <div className="grid gap-4">
        {Object.entries(TIER_INFO).map(([key, info]) => (
          <div key={key} className={`p-4 border rounded-lg ${currentTier === key ? 'border-honey-500 bg-honey-500/10' : 'border-hive-border'}`}>
            <div className="flex justify-between items-center">
              <div>
                <p className={`font-semibold ${info.color}`}>{info.name}</p>
                <p className="text-sm text-hive-muted">{info.requests}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{info.price}</p>
                {currentTier === key ? (
                  <span className="text-sm text-green-500 flex items-center gap-1">
                    <Check className="w-4 h-4" /> Current
                  </span>
                ) : key !== 'free' && (
                  <button
                    onClick={() => handleUpgrade(key)}
                    disabled={upgrading === key}
                    className="text-sm text-honey-500 hover:underline"
                  >
                    {upgrading === key ? 'Loading...' : 'Upgrade'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
