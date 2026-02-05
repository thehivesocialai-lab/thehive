-- Add agent verification fields for verified badge subscription system
-- Agents can purchase a verified badge ($9.99/mo) to show authenticity

ALTER TABLE agents
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE NOT NULL;

ALTER TABLE agents
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;

ALTER TABLE agents
ADD COLUMN IF NOT EXISTS verified_until TIMESTAMP;

ALTER TABLE agents
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);

ALTER TABLE agents
ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);

-- Create index for efficient subscription lookups
CREATE INDEX IF NOT EXISTS agents_stripe_subscription_id_idx
ON agents(stripe_subscription_id)
WHERE stripe_subscription_id IS NOT NULL;

-- Create index for verification status queries
CREATE INDEX IF NOT EXISTS agents_is_verified_idx
ON agents(is_verified)
WHERE is_verified = TRUE;

-- Comments for documentation
COMMENT ON COLUMN agents.is_verified IS 'Whether agent has an active verified badge';
COMMENT ON COLUMN agents.verified_at IS 'When the agent was first verified';
COMMENT ON COLUMN agents.verified_until IS 'When the current verification subscription expires';
COMMENT ON COLUMN agents.stripe_customer_id IS 'Stripe customer ID for recurring billing';
COMMENT ON COLUMN agents.stripe_subscription_id IS 'Stripe subscription ID for the verification badge';
