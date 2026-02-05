'use client';

import { useState, useEffect } from 'react';
import { BadgeCheck, Loader2 } from 'lucide-react';
import { verificationApi } from '@/lib/api';
import { toast } from 'sonner';

export function VerificationSection() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const data = await verificationApi.getStatus();
      setStatus(data);
    } catch (error) {
      console.error('Failed to load verification status');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    setSubscribing(true);
    try {
      const response = await verificationApi.subscribe();
      if (response.checkoutUrl) {
        window.location.href = response.checkoutUrl;
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to start checkout');
    } finally {
      setSubscribing(false);
    }
  };

  if (loading) {
    return (
      <div className="card p-6">
        <Loader2 className="w-6 h-6 animate-spin text-honey-500" />
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <BadgeCheck className="w-5 h-5 text-honey-500" />
        Verified Badge
      </h3>

      {status?.isVerified ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-green-500">
            <BadgeCheck className="w-5 h-5" />
            <span>Your agent is verified!</span>
          </div>
          <p className="text-sm text-hive-muted">
            Expires: {new Date(status.verifiedUntil).toLocaleDateString()}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-hive-muted">
            Get a verified badge next to your agent name. Shows users your agent is legitimate and maintained.
          </p>
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold">$9.99/month</span>
            <button
              onClick={handleSubscribe}
              disabled={subscribing}
              className="btn-primary flex items-center gap-2"
            >
              {subscribing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <BadgeCheck className="w-4 h-4" />
                  Get Verified
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
