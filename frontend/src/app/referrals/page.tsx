'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { referralsApi } from '@/lib/api';
import { toast } from 'sonner';
import { Copy, Gift, TrendingUp, Users, Calendar, Check, Trash2 } from 'lucide-react';

interface ReferralCode {
  id: string;
  code: string;
  usesRemaining: number;
  maxUses: number;
  karmaReward: number;
  expiresAt: string;
  createdAt: string;
  timesUsed: number;
  totalKarmaEarned: number;
  link: string;
  isExpired: boolean;
}

interface ReferralStats {
  totalCodes: number;
  totalReferrals: number;
  totalKarmaEarned: number;
}

export default function ReferralsPage() {
  const router = useRouter();
  const [codes, setCodes] = useState<ReferralCode[]>([]);
  const [stats, setStats] = useState<ReferralStats>({ totalCodes: 0, totalReferrals: 0, totalKarmaEarned: 0 });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadCodes();
  }, []);

  async function loadCodes() {
    try {
      const response = await referralsApi.getMyCodes();
      setCodes(response.codes);
      setStats(response.stats);
    } catch (error: any) {
      if (error.status === 401) {
        router.push('/login');
        return;
      }
      toast.error('Failed to load referral codes');
    } finally {
      setLoading(false);
    }
  }

  async function generateCode() {
    setGenerating(true);
    try {
      const response = await referralsApi.generate();
      toast.success(`Created referral code: ${response.code}`);
      loadCodes();
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate code');
    } finally {
      setGenerating(false);
    }
  }

  async function copyLink(code: ReferralCode) {
    await navigator.clipboard.writeText(code.link);
    setCopiedId(code.id);
    toast.success('Link copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function deleteCode(codeId: string) {
    if (!confirm('Are you sure you want to delete this referral code?')) {
      return;
    }

    try {
      await referralsApi.delete(codeId);
      toast.success('Referral code deleted');
      loadCodes();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete code');
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-green-400">Invite Friends</h1>
          <p className="text-gray-400">
            Share TheHive with friends and earn karma rewards when they join.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
            <div className="flex items-center gap-3 mb-2">
              <Gift className="w-5 h-5 text-green-400" />
              <span className="text-gray-400 text-sm">Total Karma Earned</span>
            </div>
            <p className="text-3xl font-bold text-green-400">{stats.totalKarmaEarned}</p>
          </div>

          <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5 text-blue-400" />
              <span className="text-gray-400 text-sm">Total Referrals</span>
            </div>
            <p className="text-3xl font-bold text-white">{stats.totalReferrals}</p>
          </div>

          <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              <span className="text-gray-400 text-sm">Active Codes</span>
            </div>
            <p className="text-3xl font-bold text-white">
              {codes.filter(c => !c.isExpired && c.usesRemaining > 0).length}
            </p>
          </div>
        </div>

        {/* Generate Button */}
        <div className="mb-8">
          <button
            onClick={generateCode}
            disabled={generating}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Gift className="w-5 h-5" />
            {generating ? 'Generating...' : 'Generate New Code'}
          </button>
        </div>

        {/* How It Works */}
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 mb-8">
          <h2 className="text-xl font-bold mb-4 text-green-400">How It Works</h2>
          <div className="space-y-3 text-gray-400">
            <div className="flex items-start gap-3">
              <span className="text-green-400 font-bold">1.</span>
              <p>Generate a referral code and share the link with friends</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-green-400 font-bold">2.</span>
              <p>When they sign up using your code, they get 10 bonus karma/credits</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-green-400 font-bold">3.</span>
              <p>You earn 50 karma for each successful referral</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-green-400 font-bold">4.</span>
              <p>Each code has 10 uses and expires in 30 days</p>
            </div>
          </div>
        </div>

        {/* Codes List */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Your Referral Codes</h2>

          {codes.length === 0 ? (
            <div className="bg-gray-900 rounded-lg p-12 border border-gray-800 text-center">
              <Gift className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 mb-4">You haven't created any referral codes yet.</p>
              <button
                onClick={generateCode}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Generate Your First Code
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {codes.map((code) => (
                <div
                  key={code.id}
                  className={`bg-gray-900 rounded-lg p-6 border ${
                    code.isExpired || code.usesRemaining === 0
                      ? 'border-gray-800 opacity-60'
                      : 'border-gray-700'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <code className="text-2xl font-bold text-green-400">
                          {code.code}
                        </code>
                        {(code.isExpired || code.usesRemaining === 0) && (
                          <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded">
                            {code.isExpired ? 'EXPIRED' : 'NO USES LEFT'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {code.timesUsed} / {code.maxUses} uses
                        </span>
                        <span className="flex items-center gap-1">
                          <Gift className="w-4 h-4" />
                          {code.totalKarmaEarned} karma earned
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          Expires {formatDate(code.expiresAt)}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyLink(code)}
                        className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded transition-colors"
                      >
                        {copiedId === code.id ? (
                          <>
                            <Check className="w-4 h-4 text-green-400" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Copy Link
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => deleteCode(code.id)}
                        className="p-2 bg-gray-800 hover:bg-red-900/30 text-gray-400 hover:text-red-400 rounded transition-colors"
                        title="Delete code"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full transition-all"
                      style={{
                        width: `${(code.timesUsed / code.maxUses) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
