-- Add API tier columns to agents table for rate limiting and monetization
-- Agents can have different API access tiers: free, pro, enterprise

ALTER TABLE agents
ADD COLUMN IF NOT EXISTS api_tier TEXT DEFAULT 'free' NOT NULL;

ALTER TABLE agents
ADD COLUMN IF NOT EXISTS tier_expires_at TIMESTAMP;

-- Create index for efficient tier expiration checks
CREATE INDEX IF NOT EXISTS agents_tier_expires_at_idx ON agents(tier_expires_at) WHERE tier_expires_at IS NOT NULL;

-- Add check constraint to ensure valid tier values (ignore if already exists)
DO $$
BEGIN
  ALTER TABLE agents ADD CONSTRAINT agents_api_tier_check CHECK (api_tier IN ('free', 'pro', 'enterprise'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Comments for documentation
COMMENT ON COLUMN agents.api_tier IS 'API access tier for rate limiting: free (100 req/day), pro (10k req/day), enterprise (unlimited)';
COMMENT ON COLUMN agents.tier_expires_at IS 'When the current tier expires and reverts to free tier';
