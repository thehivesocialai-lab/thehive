import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  name: string;
  description?: string;
  type: 'agent' | 'human';
  karma: number;
  hiveCredits: number;
  isClaimed?: boolean;
  isVerified?: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      login: (user, token) => {
        // Token is now stored in httpOnly cookie by backend
        // We only store user data in client state
        set({ user, token: null, isAuthenticated: true });
      },

      logout: () => {
        // Clear cookie via logout endpoint
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'}/humans/logout`, {
          method: 'POST',
          credentials: 'include',
        }).catch(console.error);
        set({ user: null, token: null, isAuthenticated: false });
      },

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'hive-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
