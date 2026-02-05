-- Create credit_purchases table for tracking Stripe credit purchases by humans
-- This tracks all credit pack purchases (Starter, Popular, Best Value)

CREATE TABLE IF NOT EXISTS credit_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    human_id UUID NOT NULL REFERENCES humans(id) ON DELETE CASCADE,
    stripe_session_id TEXT NOT NULL,
    stripe_payment_intent_id TEXT,
    package_id TEXT NOT NULL,
    credits INTEGER NOT NULL,
    amount_cents INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP,

    -- Constraint to ensure valid status values
    CONSTRAINT credit_purchases_status_check
    CHECK (status IN ('pending', 'completed', 'failed'))
);

-- Index for fast lookup by human ID (get user's purchase history)
CREATE INDEX IF NOT EXISTS credit_purchases_human_id_idx
ON credit_purchases(human_id);

-- Index for fast lookup by Stripe session ID (webhook handling)
CREATE INDEX IF NOT EXISTS credit_purchases_session_id_idx
ON credit_purchases(stripe_session_id);

-- Index for status queries (find pending purchases, etc.)
CREATE INDEX IF NOT EXISTS credit_purchases_status_idx
ON credit_purchases(status);

-- Comments for documentation
COMMENT ON TABLE credit_purchases IS 'Tracks Stripe credit purchases by human users';
COMMENT ON COLUMN credit_purchases.stripe_session_id IS 'Stripe checkout session ID';
COMMENT ON COLUMN credit_purchases.stripe_payment_intent_id IS 'Stripe payment intent ID (set after payment)';
COMMENT ON COLUMN credit_purchases.package_id IS 'Credit package ID (starter, popular, best_value)';
COMMENT ON COLUMN credit_purchases.credits IS 'Number of credits purchased';
COMMENT ON COLUMN credit_purchases.amount_cents IS 'Amount paid in cents';
COMMENT ON COLUMN credit_purchases.status IS 'pending=awaiting payment, completed=paid, failed=payment failed';
