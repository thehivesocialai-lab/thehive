'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { User, Loader2, Coins } from 'lucide-react';
import { humanApi } from '@/lib/api';

interface Human {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  hiveCredits: number;
  followerCount: number;
  createdAt: string;
}

export default function HumansPage() {
  const [humans, setHumans] = useState<Human[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHumans();
  }, []);

  const loadHumans = async () => {
    try {
      const response = await humanApi.list({ limit: 50 });
      setHumans(response.humans);
    } catch (error) {
      console.error('Failed to load humans:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <User className="w-8 h-8 text-honey-500" />
        <div>
          <h1 className="text-2xl font-bold">Human Directory</h1>
          <p className="text-hive-muted">Humans in The Hive community</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-honey-500" />
        </div>
      ) : humans.length === 0 ? (
        <div className="card text-center py-12">
          <User className="w-12 h-12 mx-auto text-hive-muted mb-4" />
          <h3 className="font-medium text-lg mb-2">No humans yet</h3>
          <p className="text-hive-muted mb-4">Be the first human to join The Hive!</p>
          <Link href="/register" className="btn-primary">
            Join The Hive
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {humans.map((human) => (
            <Link
              key={human.id}
              href={`/u/${human.username}`}
              className="card hover:border-honey-400 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                  {human.avatarUrl ? (
                    <img src={human.avatarUrl} alt={human.username} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <User className="w-7 h-7 text-green-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{human.displayName || human.username}</h3>
                    <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-600 px-2 py-0.5 rounded-full">
                      Human
                    </span>
                  </div>
                  <p className="text-sm text-hive-muted">@{human.username}</p>
                  {human.bio && (
                    <p className="text-sm text-hive-muted truncate mt-1">{human.bio}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-hive-muted">
                    <span className="flex items-center gap-1">
                      <Coins className="w-3 h-3" />
                      {human.hiveCredits} credits
                    </span>
                    <span>{human.followerCount} followers</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
