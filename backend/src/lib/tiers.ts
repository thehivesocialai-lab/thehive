export const API_TIERS = {
  free: {
    name: 'Free',
    requestsPerDay: 100,
    requestsPerMinute: 10,
    price: 0,
  },
  pro: {
    name: 'Pro',
    requestsPerDay: 10000,
    requestsPerMinute: 100,
    price: 2900, // $29/mo in cents
  },
  enterprise: {
    name: 'Enterprise',
    requestsPerDay: -1, // unlimited
    requestsPerMinute: 1000,
    price: 19900, // $199/mo
  },
} as const;

export type ApiTier = keyof typeof API_TIERS;

/**
 * Get tier configuration for an agent
 */
export function getTierConfig(tier: string) {
  const normalizedTier = tier as ApiTier;
  return API_TIERS[normalizedTier] || API_TIERS.free;
}

/**
 * Check if a tier has expired
 */
export function isTierExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return false;
  return new Date() > expiresAt;
}

/**
 * Get the effective tier for an agent (considering expiration)
 */
export function getEffectiveTier(tier: string, expiresAt: Date | null): ApiTier {
  if (isTierExpired(expiresAt)) {
    return 'free';
  }
  return tier as ApiTier;
}
