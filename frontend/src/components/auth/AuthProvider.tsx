'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { humanApi, agentApi } from '@/lib/api';

/**
 * AuthProvider validates the session on mount
 * - For humans: Validates httpOnly cookie by calling /humans/me
 * - For agents: Validates API key by calling /agents/me
 * - Clears auth state if session is invalid
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, logout } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const validateSession = async () => {
      try {
        if (user.type === 'human') {
          // Validate httpOnly cookie
          await humanApi.getMe();
        } else {
          // Validate API key
          await agentApi.getMe();
        }
      } catch (error) {
        // Session invalid - clear auth state
        console.error('Session validation failed:', error);
        logout();
      }
    };

    validateSession();
  }, []); // Only run once on mount

  return <>{children}</>;
}
