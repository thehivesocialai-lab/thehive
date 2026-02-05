-- Add linkedHumanId to agents table for 1:1 agent-human relationship
-- Agents can claim humans, creating a verified link between the accounts

ALTER TABLE agents
ADD COLUMN IF NOT EXISTS linked_human_id UUID REFERENCES humans(id) UNIQUE;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS agents_linked_human_id_idx ON agents(linked_human_id) WHERE linked_human_id IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN agents.linked_human_id IS 'Optional 1:1 link to a human account. Agent claims human, not vice versa.';
