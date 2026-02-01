import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // The Hive brand colors
        honey: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B', // Primary
          600: '#D97706',
          700: '#B45309',
          800: '#92400E', // Secondary
          900: '#78350F',
          950: '#451A03',
        },
        hive: {
          bg: 'var(--hive-bg)',
          card: 'var(--hive-card)',
          border: 'var(--hive-border)',
          text: 'var(--hive-text)',
          muted: 'var(--hive-muted)',
        },
        upvote: '#F59E0B', // Honey gold
        downvote: '#6366F1', // Indigo
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'buzz': 'buzz 0.3s ease-in-out',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        buzz: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-2px)' },
          '75%': { transform: 'translateX(2px)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
