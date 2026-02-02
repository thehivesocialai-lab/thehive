'use client';

import { useState } from 'react';
import { CheckCircle2, Clock, BarChart2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { pollApi } from '@/lib/api';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth';

interface PollOption {
  id: string;
  text: string;
  voteCount: number;
  percentage: number;
}

interface PollData {
  id: string;
  postId: string;
  expiresAt: string | null;
  totalVotes: number;
  isExpired: boolean;
  options: PollOption[];
  userVote: string | null;
}

interface PollProps {
  poll: PollData;
  onVote?: (poll: PollData) => void;
}

export function Poll({ poll: initialPoll, onVote }: PollProps) {
  const { isAuthenticated } = useAuthStore();
  const [poll, setPoll] = useState(initialPoll);
  const [voting, setVoting] = useState(false);

  const hasVoted = !!poll.userVote;
  const showResults = hasVoted || poll.isExpired;

  const handleVote = async (optionId: string) => {
    if (!isAuthenticated) {
      toast.error('Sign in to vote');
      return;
    }

    if (hasVoted) {
      toast.error('You have already voted');
      return;
    }

    if (poll.isExpired) {
      toast.error('This poll has ended');
      return;
    }

    setVoting(true);
    try {
      const response = await pollApi.vote(poll.id, optionId);
      const updatedPoll = {
        ...poll,
        totalVotes: response.poll.totalVotes,
        options: response.poll.options,
        userVote: response.poll.userVote,
      };
      setPoll(updatedPoll);
      onVote?.(updatedPoll);
      toast.success('Vote recorded!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to vote');
    } finally {
      setVoting(false);
    }
  };

  return (
    <div className="border border-hive-border rounded-lg p-4 my-3">
      <div className="flex items-center gap-2 mb-3 text-sm text-hive-muted">
        <BarChart2 className="w-4 h-4" />
        <span>{poll.totalVotes} vote{poll.totalVotes !== 1 ? 's' : ''}</span>
        {poll.expiresAt && (
          <>
            <span>•</span>
            <Clock className="w-4 h-4" />
            {poll.isExpired ? (
              <span className="text-red-500">Ended</span>
            ) : (
              <span>Ends {formatDistanceToNow(new Date(poll.expiresAt), { addSuffix: true })}</span>
            )}
          </>
        )}
      </div>

      <div className="space-y-2">
        {poll.options.map((option) => {
          const isSelected = poll.userVote === option.id;
          const isWinning = showResults && option.voteCount === Math.max(...poll.options.map(o => o.voteCount)) && option.voteCount > 0;

          return (
            <button
              key={option.id}
              onClick={() => !showResults && handleVote(option.id)}
              disabled={voting || showResults}
              className={`w-full relative overflow-hidden rounded-lg border transition-all ${
                showResults
                  ? isSelected
                    ? 'border-honey-500 bg-honey-50 dark:bg-honey-900/20'
                    : 'border-hive-border bg-hive-hover'
                  : 'border-hive-border hover:border-honey-400 hover:bg-honey-50 dark:hover:bg-honey-900/10'
              }`}
            >
              {/* Progress bar for results */}
              {showResults && (
                <div
                  className={`absolute inset-y-0 left-0 transition-all ${
                    isWinning ? 'bg-honey-200 dark:bg-honey-800/30' : 'bg-hive-hover'
                  }`}
                  style={{ width: `${option.percentage}%` }}
                />
              )}

              <div className="relative flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  {isSelected && (
                    <CheckCircle2 className="w-4 h-4 text-honey-500" />
                  )}
                  <span className={`font-medium ${isWinning && showResults ? 'text-honey-600' : ''}`}>
                    {option.text}
                  </span>
                </div>
                {showResults && (
                  <span className={`text-sm font-semibold ${isWinning ? 'text-honey-600' : 'text-hive-muted'}`}>
                    {option.percentage}%
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {!isAuthenticated && !showResults && (
        <p className="text-xs text-hive-muted mt-3 text-center">
          Sign in to vote
        </p>
      )}
    </div>
  );
}
