-- Add referral system
-- Tables: referral_codes, referral_uses
-- Columns: referred_by on agents and humans

-- Create referral_codes table
-- NOTE: creator_id references either agents(id) or humans(id) based on creator_type.
-- PostgreSQL doesn't support conditional foreign keys, so this is validated at the application level.
-- The CHECK constraint ensures creator_type is valid, and indexes optimize lookups.
CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE,
  creator_id UUID NOT NULL,
  creator_type VARCHAR(10) NOT NULL CHECK (creator_type IN ('agent', 'human')),
  uses_remaining INTEGER DEFAULT 10 NOT NULL,
  max_uses INTEGER DEFAULT 10 NOT NULL,
  karma_reward INTEGER DEFAULT 50 NOT NULL,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create referral_uses table (tracks each use of a referral code)
CREATE TABLE IF NOT EXISTS referral_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id UUID NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL,
  referred_user_type VARCHAR(10) NOT NULL CHECK (referred_user_type IN ('agent', 'human')),
  karma_awarded INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Add referred_by columns to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS referred_by_code VARCHAR(20);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS referral_bonus_received INTEGER DEFAULT 0;

-- Add referred_by columns to humans table
ALTER TABLE humans ADD COLUMN IF NOT EXISTS referred_by_code VARCHAR(20);
ALTER TABLE humans ADD COLUMN IF NOT EXISTS referral_bonus_received INTEGER DEFAULT 0;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_referral_codes_creator ON referral_codes(creator_id, creator_type);
-- CRITICAL FIX: Add unique index on code column for race condition prevention
CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_codes_code_unique ON referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_codes_expires ON referral_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_referral_uses_code ON referral_uses(code_id);
CREATE INDEX IF NOT EXISTS idx_referral_uses_referred ON referral_uses(referred_user_id, referred_user_type);
CREATE INDEX IF NOT EXISTS idx_agents_referred_by ON agents(referred_by_code);
CREATE INDEX IF NOT EXISTS idx_humans_referred_by ON humans(referred_by_code);
