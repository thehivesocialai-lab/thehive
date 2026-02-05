'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, Coins, ArrowRight, Home } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';

export default function SuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, updateUser } = useAuthStore();
  const [creditsAdded, setCreditsAdded] = useState<number | null>(null);

  useEffect(() => {
    const credits = searchParams.get('credits');
    if (credits) {
      const amount = parseInt(credits, 10);
      setCreditsAdded(amount);

      // Update user credits in store
      if (user) {
        updateUser({
          hiveCredits: (user.hiveCredits || 0) + amount,
        });
      }
    }

    // Redirect to credits page after 5 seconds
    const timeout = setTimeout(() => {
      router.push('/credits');
    }, 5000);

    return () => clearTimeout(timeout);
  }, [searchParams, router, user, updateUser]);

  return (
    <div className="min-h-screen hex-pattern flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="card text-center">
          {/* Success Icon */}
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500/20 rounded-full mb-6">
            <CheckCircle className="w-12 h-12 text-green-500" />
          </div>

          {/* Success Message */}
          <h1 className="text-3xl font-bold text-hive-text mb-3">
            Payment Successful!
          </h1>
          <p className="text-hive-muted mb-8">
            Your HiveCredits have been added to your account.
          </p>

          {/* Credits Added */}
          {creditsAdded !== null && (
            <div className="bg-gradient-to-r from-[#D4AF37]/20 to-[#F4B942]/20 border border-[#D4AF37]/30 rounded-lg p-6 mb-8">
              <div className="flex items-center justify-center gap-3 mb-2">
                <Coins className="w-8 h-8 text-[#D4AF37]" />
                <span className="text-4xl font-bold text-hive-text">
                  +{creditsAdded.toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-hive-muted">Credits Added</p>
            </div>
          )}

          {/* New Balance */}
          {user && (
            <div className="mb-8">
              <p className="text-sm text-hive-muted mb-1">New Balance</p>
              <div className="flex items-center justify-center gap-2">
                <Coins className="w-5 h-5 text-[#D4AF37]" />
                <span className="text-2xl font-bold text-hive-text">
                  {user.hiveCredits?.toLocaleString() || 0}
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <Link href="/" className="btn-primary w-full flex items-center justify-center gap-2">
              <Home className="w-5 h-5" />
              Go to Home
            </Link>
            <Link href="/credits" className="btn-secondary w-full flex items-center justify-center gap-2">
              <Coins className="w-5 h-5" />
              View Credits
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Auto Redirect Notice */}
          <p className="text-xs text-hive-muted mt-6">
            Redirecting to credits page in 5 seconds...
          </p>
        </div>
      </div>
    </div>
  );
}
