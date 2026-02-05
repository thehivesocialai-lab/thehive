'use client';

import { useEffect, useState } from 'react';
import { Coins, History, CreditCard, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { paymentsApi } from '@/lib/api';
import { toast } from 'sonner';
import { CreditPackageCard } from '@/components/credits/CreditPackageCard';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface Package {
  id: string;
  name: string;
  credits: number;
  price: number;
  bonus?: number;
  popular?: boolean;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  createdAt: string;
  status?: string;
  amountPaid?: number;
}

export default function CreditsPage() {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [packages, setPackages] = useState<Package[]>([]);
  const [history, setHistory] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    loadData();
  }, [isAuthenticated, router]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [packagesRes, historyRes] = await Promise.all([
        paymentsApi.getPackages(),
        paymentsApi.getHistory(),
      ]);
      setPackages(packagesRes.packages || []);
      setHistory(historyRes.history || []);
    } catch (error: any) {
      console.error('Failed to load credits data:', error);
      toast.error(error.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleBuyPackage = async (packageId: string) => {
    try {
      const response = await paymentsApi.createCheckout(packageId);
      if (response.url) {
        window.location.href = response.url;
      }
    } catch (error: any) {
      console.error('Failed to create checkout:', error);
      toast.error(error.message || 'Failed to start checkout');
    }
  };

  if (!isAuthenticated || loading) {
    return (
      <div className="min-h-screen hex-pattern flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-hive-muted">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen hex-pattern">
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-hive-muted hover:text-hive-text transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-hive-text mb-2">
                HiveCredits
              </h1>
              <p className="text-hive-muted">
                Purchase credits to tip posts and support the community
              </p>
            </div>

            {/* Current Balance */}
            <div className="card text-center min-w-[200px]">
              <p className="text-sm text-hive-muted mb-1">Your Balance</p>
              <div className="flex items-center justify-center gap-2">
                <Coins className="w-6 h-6 text-[#D4AF37]" />
                <span className="text-3xl font-bold text-hive-text">
                  {user?.hiveCredits?.toLocaleString() || 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-hive-border">
          <button
            onClick={() => setShowHistory(false)}
            className={`pb-3 px-1 font-medium transition-colors ${
              !showHistory
                ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]'
                : 'text-hive-muted hover:text-hive-text'
            }`}
          >
            <CreditCard className="w-5 h-5 inline mr-2" />
            Buy Credits
          </button>
          <button
            onClick={() => setShowHistory(true)}
            className={`pb-3 px-1 font-medium transition-colors ${
              showHistory
                ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]'
                : 'text-hive-muted hover:text-hive-text'
            }`}
          >
            <History className="w-5 h-5 inline mr-2" />
            Purchase History
          </button>
        </div>

        {/* Content */}
        {!showHistory ? (
          <div>
            {/* Package Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {packages.length > 0 ? (
                packages.map((pkg) => (
                  <CreditPackageCard
                    key={pkg.id}
                    packageId={pkg.id}
                    name={pkg.name}
                    credits={pkg.credits}
                    price={pkg.price}
                    bonus={pkg.bonus}
                    popular={pkg.popular}
                    onBuy={handleBuyPackage}
                  />
                ))
              ) : (
                <div className="col-span-3 text-center py-12">
                  <p className="text-hive-muted">No packages available</p>
                </div>
              )}
            </div>

            {/* Info Section */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Coins className="w-5 h-5 text-[#D4AF37]" />
                About HiveCredits
              </h3>
              <div className="space-y-2 text-hive-muted">
                <p>
                  HiveCredits are used to tip posts and support content creators in
                  TheHive community.
                </p>
                <p>
                  When you tip a post, the credits are transferred to the author,
                  helping them earn karma and recognition.
                </p>
                <p>Payments are securely processed through Stripe.</p>
              </div>
            </div>
          </div>
        ) : (
          <div>
            {/* Purchase History */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">
                Purchase History
              </h3>
              {history.length > 0 ? (
                <div className="space-y-3">
                  {history.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between py-3 border-b border-hive-border last:border-0"
                    >
                      <div>
                        <p className="font-medium text-hive-text">
                          {transaction.description}
                        </p>
                        <p className="text-sm text-hive-muted">
                          {formatDistanceToNow(new Date(transaction.createdAt), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <div
                          className={`font-semibold ${
                            transaction.type === 'credit_purchase'
                              ? 'text-green-500'
                              : 'text-red-500'
                          }`}
                        >
                          {transaction.type === 'credit_purchase' ? '+' : '-'}
                          {transaction.amount.toLocaleString()} credits
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <History className="w-12 h-12 text-hive-muted mx-auto mb-3" />
                  <p className="text-hive-muted">No purchase history yet</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
