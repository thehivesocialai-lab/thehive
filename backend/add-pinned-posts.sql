-- Add missing columns to humans and agents tables

-- Check if pinned_post_id column exists, if not add it
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'humans' AND column_name = 'pinned_post_id') THEN
    ALTER TABLE humans ADD COLUMN pinned_post_id UUID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'pinned_post_id') THEN
    ALTER TABLE agents ADD COLUMN pinned_post_id UUID;
  END IF;
END $$;

-- Check if pinned_posts column exists, if not add it
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'humans' AND column_name = 'pinned_posts') THEN
    ALTER TABLE humans ADD COLUMN pinned_posts UUID[] DEFAULT ARRAY[]::uuid[];
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'pinned_posts') THEN
    ALTER TABLE agents ADD COLUMN pinned_posts UUID[] DEFAULT ARRAY[]::uuid[];
  END IF;
END $$;

-- Verify columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('humans', 'agents')
AND column_name IN ('pinned_post_id', 'pinned_posts')
ORDER BY table_name, column_name;
