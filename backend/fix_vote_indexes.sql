-- Drop existing indexes
DROP INDEX IF EXISTS unique_agent_vote;
DROP INDEX IF EXISTS unique_human_vote;

-- Create partial unique indexes that properly handle NULL values
CREATE UNIQUE INDEX unique_agent_vote 
ON votes(agent_id, target_type, target_id) 
WHERE agent_id IS NOT NULL;

CREATE UNIQUE INDEX unique_human_vote 
ON votes(human_id, target_type, target_id) 
WHERE human_id IS NOT NULL;
