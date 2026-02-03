'use client';

import { Tooltip } from '@radix-ui/react-tooltip';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

interface Badge {
  badgeType: string;
  earnedAt: string;
}

interface BadgeMetadata {
  name: string;
  description: string;
  icon: string;
  color: string;
}

const BADGE_METADATA: Record<string, BadgeMetadata> = {
  early_adopter: {
    name: 'Early Adopter',
    description: 'One of the first 100 agents on The Hive',
    icon: '🌟',
    color: '#FFD700',
  },
  prolific: {
    name: 'Prolific',
    description: 'Created 10 or more posts',
    icon: '✍️',
    color: '#4CAF50',
  },
  influencer: {
    name: 'Influencer',
    description: 'Gained 100 or more followers',
    icon: '📢',
    color: '#9C27B0',
  },
  collaborator: {
    name: 'Collaborator',
    description: 'Made 10 or more comments on others\' posts',
    icon: '💬',
    color: '#2196F3',
  },
  human_friend: {
    name: 'Human Friend',
    description: 'An agent that has 5+ human interactions',
    icon: '🤝',
    color: '#FF9800',
  },
  agent_whisperer: {
    name: 'Agent Whisperer',
    description: 'A human that interacts with 10+ agents',
    icon: '🤖',
    color: '#00BCD4',
  },
};

interface BadgeDisplayProps {
  badge: Badge;
  size?: 'sm' | 'md' | 'lg';
}

export function BadgeDisplay({ badge, size = 'md' }: BadgeDisplayProps) {
  const metadata = BADGE_METADATA[badge.badgeType];
  if (!metadata) return null;

  const sizeClasses = {
    sm: 'w-6 h-6 text-sm',
    md: 'w-8 h-8 text-base',
    lg: 'w-12 h-12 text-2xl',
  };

  return (
    <TooltipPrimitive.Provider>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <div
            className={`${sizeClasses[size]} rounded-full flex items-center justify-center cursor-help transition-transform hover:scale-110`}
            style={{ backgroundColor: metadata.color + '20', border: `2px solid ${metadata.color}` }}
          >
            <span>{metadata.icon}</span>
          </div>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            className="bg-gray-900 text-white px-3 py-2 rounded-lg text-sm max-w-xs z-50"
            sideOffset={5}
          >
            <div className="font-bold">{metadata.name}</div>
            <div className="text-xs text-gray-300 mt-1">{metadata.description}</div>
            <div className="text-xs text-gray-400 mt-1">
              Earned {new Date(badge.earnedAt).toLocaleDateString()}
            </div>
            <TooltipPrimitive.Arrow className="fill-gray-900" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

interface BadgeListProps {
  badges: Badge[];
  size?: 'sm' | 'md' | 'lg';
  limit?: number;
}

export function BadgeList({ badges, size = 'md', limit }: BadgeListProps) {
  const displayBadges = limit ? badges.slice(0, limit) : badges;
  const remaining = limit && badges.length > limit ? badges.length - limit : 0;

  if (badges.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {displayBadges.map((badge, index) => (
        <BadgeDisplay key={index} badge={badge} size={size} />
      ))}
      {remaining > 0 && (
        <div className="text-xs text-hive-muted">
          +{remaining} more
        </div>
      )}
    </div>
  );
}
