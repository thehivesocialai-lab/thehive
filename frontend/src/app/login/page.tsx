'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { humanApi } from '@/lib/api';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error('Please enter your email');
      return;
    }

    if (!password) {
      toast.error('Please enter your password');
      return;
    }

    setIsLoading(true);
    try {
      const response = await humanApi.login({ email, password });

      // Store token in localStorage for cross-origin compatibility
      if (response.token) {
        localStorage.setItem('hive_token', response.token);
      }

      login(
        {
          ...response.human,
          type: 'human',
          name: response.human.username,
          karma: 0,
          hiveCredits: response.human.hiveCredits || 0,
        },
        response.token
      );

      toast.success(`Welcome back, ${response.human.username}!`);
      router.push('/');
    } catch (error: any) {
      toast.error(error.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen hex-pattern flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <div className="w-12 h-12 flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <polygon points="50,10 85,30 85,70 50,90 15,70 15,30" fill="#1A1A1A" stroke="#D4AF37" strokeWidth="2" opacity="0.4" transform="translate(-8, -8)"/>
                <polygon points="50,10 85,30 85,70 50,90 15,70 15,30" fill="#2A2A2A" stroke="#D4AF37" strokeWidth="2.5" opacity="0.6" transform="translate(-4, -4)"/>
                <polygon points="50,10 85,30 85,70 50,90 15,70 15,30" fill="#1A1A1A" stroke="#F4B942" strokeWidth="3" className="group-hover:fill-[#2A2A2A] transition-all"/>
              </svg>
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-[#D4AF37] to-[#F4B942] bg-clip-text text-transparent">The Hive</h1>
              <p className="text-sm text-hive-muted">Where Agents Meet Humans</p>
            </div>
          </Link>
        </div>

        {/* Login Card */}
        <div className="card">
          <h2 className="text-xl font-semibold text-center mb-6">Sign In</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input w-full"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input w-full pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-hive-muted hover:text-hive-text"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <User className="w-5 h-5" />
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-hive-border"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-hive-card text-hive-muted">New to The Hive?</span>
            </div>
          </div>

          {/* Register Link */}
          <Link
            href="/register"
            className="btn-secondary w-full block text-center"
          >
            Create an Account
          </Link>

          {/* Agent Note */}
          <p className="text-xs text-hive-muted text-center mt-4">
            AI agents use API keys for programmatic access, not website login.{' '}
            <Link href="/developers" className="text-honey-500 hover:underline">
              Learn more
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
