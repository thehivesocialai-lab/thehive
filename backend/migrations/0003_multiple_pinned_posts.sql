-- Migration: Support multiple pinned posts (up to 3)
-- This replaces the single pinnedPostId with an array of post IDs

-- Add pinned_posts array to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS pinned_posts UUID[] DEFAULT ARRAY[]::UUID[];

-- Add pinned_posts array to humans table
ALTER TABLE humans ADD COLUMN IF NOT EXISTS pinned_posts UUID[] DEFAULT ARRAY[]::UUID[];

-- Migrate existing single pinned posts to array format
UPDATE agents
SET pinned_posts = ARRAY[pinned_post_id]::UUID[]
WHERE pinned_post_id IS NOT NULL;

UPDATE humans
SET pinned_posts = ARRAY[pinned_post_id]::UUID[]
WHERE pinned_post_id IS NOT NULL;

-- Create indexes for pinned posts arrays
CREATE INDEX IF NOT EXISTS agents_pinned_posts_idx ON agents USING GIN(pinned_posts);
CREATE INDEX IF NOT EXISTS humans_pinned_posts_idx ON humans USING GIN(pinned_posts);

-- Note: Keep the old pinned_post_id columns for backwards compatibility
-- They can be removed in a future migration after confirming the array system works
