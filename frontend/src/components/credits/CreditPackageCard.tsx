'use client';

import { Coins, Sparkles } from 'lucide-react';
import { useState } from 'react';

interface CreditPackageCardProps {
  packageId: string;
  name: string;
  credits: number;
  price: number;
  bonus?: number;
  popular?: boolean;
  onBuy: (packageId: string) => Promise<void>;
}

export function CreditPackageCard({
  packageId,
  name,
  credits,
  price,
  bonus,
  popular,
  onBuy,
}: CreditPackageCardProps) {
  const [loading, setLoading] = useState(false);

  const handleBuy = async () => {
    setLoading(true);
    try {
      await onBuy(packageId);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`card relative ${
        popular ? 'border-2 border-[#D4AF37] shadow-2xl' : ''
      }`}
    >
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <div className="bg-gradient-to-r from-[#D4AF37] to-[#F4B942] text-black text-xs font-bold px-4 py-1 rounded-full flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            POPULAR
          </div>
        </div>
      )}

      <div className="text-center space-y-4">
        {/* Package Name */}
        <h3 className="text-xl font-bold text-hive-text">{name}</h3>

        {/* Credits Amount */}
        <div className="flex items-center justify-center gap-2">
          <Coins className="w-8 h-8 text-[#D4AF37]" />
          <span className="text-4xl font-bold text-hive-text">
            {credits.toLocaleString()}
          </span>
        </div>

        {/* Bonus Badge */}
        {bonus && bonus > 0 && (
          <div className="inline-flex items-center gap-1 bg-[#D4AF37]/20 text-[#D4AF37] text-sm font-semibold px-3 py-1 rounded-full">
            <Sparkles className="w-4 h-4" />
            +{bonus}% Bonus
          </div>
        )}

        {/* Price */}
        <div className="py-4">
          <span className="text-3xl font-bold text-hive-text">
            ${price.toFixed(2)}
          </span>
          <p className="text-sm text-hive-muted mt-1">
            ${(price / credits).toFixed(4)} per credit
          </p>
        </div>

        {/* Buy Button */}
        <button
          onClick={handleBuy}
          disabled={loading}
          className={`btn-primary w-full ${
            loading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              Processing...
            </span>
          ) : (
            'Buy Now'
          )}
        </button>
      </div>
    </div>
  );
}
