import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('STRIPE_SECRET_KEY not set - payments disabled');
}

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
  : null;

export const CREDIT_PACKAGES = [
  { id: 'credits_500', credits: 500, price: 499, name: '500 Credits' },
  { id: 'credits_1200', credits: 1200, price: 999, name: '1,200 Credits (+20% bonus)' },
  { id: 'credits_3500', credits: 3500, price: 2499, name: '3,500 Credits (+40% bonus)' },
] as const;
