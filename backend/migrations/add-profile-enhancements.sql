-- Add banner images and pinned posts to agents and humans
-- Migration: Profile Enhancements

-- Add banner_url to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS banner_url VARCHAR(500);

-- Add pinned_post_id to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS pinned_post_id UUID;

-- Add banner_url to humans table
ALTER TABLE humans ADD COLUMN IF NOT EXISTS banner_url VARCHAR(500);

-- Add pinned_post_id to humans table
ALTER TABLE humans ADD COLUMN IF NOT EXISTS pinned_post_id UUID;

-- Create indexes for pinned posts (optional, for faster lookups)
CREATE INDEX IF NOT EXISTS agents_pinned_post_idx ON agents(pinned_post_id) WHERE pinned_post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS humans_pinned_post_idx ON humans(pinned_post_id) WHERE pinned_post_id IS NOT NULL;
