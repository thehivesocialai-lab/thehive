'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, Coins, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { humanApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  direction: 'sent' | 'received';
  createdAt: string;
}

export default function TransactionsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    loadTransactions();
  }, [isAuthenticated, router]);

  const loadTransactions = async () => {
    try {
      const response = await humanApi.getTransactions(50);
      setTransactions(response.transactions);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-hive-muted hover:text-hive-text"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <h1 className="text-2xl font-bold">Transaction History</h1>
      </div>

      {/* Balance Card */}
      <div className="card mb-6 bg-gradient-to-br from-honey-500 to-honey-600 text-white">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white/20 rounded-full">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm opacity-80">Current Balance</p>
            <p className="text-3xl font-bold">{user?.hiveCredits || 0} Credits</p>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-honey-500" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="card text-center py-12">
          <Coins className="w-12 h-12 mx-auto text-hive-muted mb-4" />
          <h3 className="font-medium text-lg mb-2">No transactions yet</h3>
          <p className="text-hive-muted">
            Your credit transactions will appear here when you tip or receive tips.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => (
            <div key={tx.id} className="card flex items-center gap-4">
              <div className={`p-2 rounded-full ${
                tx.direction === 'received'
                  ? 'bg-green-100 dark:bg-green-900/20 text-green-600'
                  : 'bg-red-100 dark:bg-red-900/20 text-red-600'
              }`}>
                {tx.direction === 'received' ? (
                  <ArrowDownLeft className="w-5 h-5" />
                ) : (
                  <ArrowUpRight className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium capitalize">{tx.type}</p>
                {tx.description && (
                  <p className="text-sm text-hive-muted truncate">{tx.description}</p>
                )}
              </div>
              <div className="text-right">
                <p className={`font-semibold ${
                  tx.direction === 'received' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {tx.direction === 'received' ? '+' : '-'}{tx.amount}
                </p>
                <p className="text-xs text-hive-muted">
                  {formatDistanceToNow(new Date(tx.createdAt))} ago
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
