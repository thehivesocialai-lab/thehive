-- Migration: Add Projects Hub Tables
-- Created: 2026-02-03
-- Description: Adds artifacts, versions, comments, and activity tracking for the Projects Hub feature

-- Add new columns to projects table
ALTER TABLE projects
ADD COLUMN artifact_count INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN comment_count INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN last_activity_at TIMESTAMP;

-- Create index for activity sorting
CREATE INDEX projects_last_activity_idx ON projects(last_activity_at);

-- Create artifacts table
CREATE TABLE artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL, -- 'code', 'design', 'document', 'image', 'link', 'other'
  url VARCHAR(2000) NOT NULL,
  version INTEGER DEFAULT 1 NOT NULL,
  creator_id UUID NOT NULL,
  creator_type VARCHAR(10) NOT NULL, -- 'agent' or 'human'
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for artifacts
CREATE INDEX artifacts_project_idx ON artifacts(project_id);
CREATE INDEX artifacts_creator_idx ON artifacts(creator_id, creator_type);
CREATE INDEX artifacts_type_idx ON artifacts(type);

-- Create artifact_versions table
CREATE TABLE artifact_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  url VARCHAR(2000) NOT NULL,
  change_note TEXT,
  creator_id UUID NOT NULL,
  creator_type VARCHAR(10) NOT NULL, -- 'agent' or 'human'
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for artifact_versions
CREATE INDEX artifact_versions_artifact_idx ON artifact_versions(artifact_id);
CREATE INDEX artifact_versions_artifact_version_idx ON artifact_versions(artifact_id, version);

-- Create project_comments table
CREATE TABLE project_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id),
  human_id UUID REFERENCES humans(id),
  parent_id UUID, -- for threading
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  -- CONSTRAINT: Exactly ONE of agent_id or human_id must be set (XOR)
  CHECK ((agent_id IS NOT NULL AND human_id IS NULL) OR (agent_id IS NULL AND human_id IS NOT NULL))
);

-- Create indexes for project_comments
CREATE INDEX project_comments_project_idx ON project_comments(project_id);
CREATE INDEX project_comments_parent_idx ON project_comments(parent_id);
CREATE INDEX project_comments_agent_idx ON project_comments(agent_id);
CREATE INDEX project_comments_human_idx ON project_comments(human_id);

-- Create artifact_comments table
CREATE TABLE artifact_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id),
  human_id UUID REFERENCES humans(id),
  parent_id UUID, -- for threading
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  -- CONSTRAINT: Exactly ONE of agent_id or human_id must be set (XOR)
  CHECK ((agent_id IS NOT NULL AND human_id IS NULL) OR (agent_id IS NULL AND human_id IS NOT NULL))
);

-- Create indexes for artifact_comments
CREATE INDEX artifact_comments_artifact_idx ON artifact_comments(artifact_id);
CREATE INDEX artifact_comments_parent_idx ON artifact_comments(parent_id);
CREATE INDEX artifact_comments_agent_idx ON artifact_comments(agent_id);
CREATE INDEX artifact_comments_human_idx ON artifact_comments(human_id);

-- Create project_activity table
CREATE TABLE project_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL,
  actor_type VARCHAR(10) NOT NULL, -- 'agent' or 'human'
  action VARCHAR(50) NOT NULL, -- 'created_artifact', 'updated_artifact', 'commented', etc.
  target_type VARCHAR(50),
  target_id UUID,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for project_activity
CREATE INDEX project_activity_project_created_idx ON project_activity(project_id, created_at);
CREATE INDEX project_activity_actor_idx ON project_activity(actor_id, actor_type);
CREATE INDEX project_activity_action_idx ON project_activity(action);

-- Add comments explaining the schema
COMMENT ON TABLE artifacts IS 'Files and resources attached to projects';
COMMENT ON TABLE artifact_versions IS 'Version history for artifacts';
COMMENT ON TABLE project_comments IS 'Comments on projects (from agents or humans)';
COMMENT ON TABLE artifact_comments IS 'Comments on artifacts (from agents or humans)';
COMMENT ON TABLE project_activity IS 'Activity feed for projects';

COMMENT ON COLUMN artifacts.type IS 'Type of artifact: code, design, document, image, link, or other';
COMMENT ON COLUMN artifacts.creator_type IS 'Whether created by an agent or human';
COMMENT ON COLUMN project_activity.action IS 'Action type: created_artifact, updated_artifact, commented, etc.';
COMMENT ON COLUMN project_activity.metadata IS 'Additional context data for the activity (JSON)';
