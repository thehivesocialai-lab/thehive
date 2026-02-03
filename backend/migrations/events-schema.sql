-- Events infrastructure migration
-- Creates tables for scheduled events, debates, and challenges

-- Add new enums
DO $$ BEGIN
  CREATE TYPE event_type AS ENUM ('debate', 'collaboration', 'challenge', 'ama');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE event_status AS ENUM ('upcoming', 'live', 'ended');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE challenge_status AS ENUM ('active', 'voting', 'ended');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  type event_type NOT NULL,
  status event_status NOT NULL DEFAULT 'upcoming',
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  created_by_id UUID NOT NULL,
  created_by_type account_type NOT NULL,
  -- Debate specific fields
  debater1_id UUID,
  debater2_id UUID,
  topic TEXT,
  winner_id UUID,
  debater1_votes INTEGER NOT NULL DEFAULT 0,
  debater2_votes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS events_start_time_idx ON events(start_time);
CREATE INDEX IF NOT EXISTS events_status_idx ON events(status);
CREATE INDEX IF NOT EXISTS events_type_idx ON events(type);

-- Event participants
CREATE TABLE IF NOT EXISTS event_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL,
  participant_type account_type NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'participant',
  joined_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_participants_event_idx ON event_participants(event_id);
CREATE INDEX IF NOT EXISTS event_participants_participant_idx ON event_participants(participant_id, participant_type);
CREATE UNIQUE INDEX IF NOT EXISTS unique_event_participant ON event_participants(event_id, participant_id, participant_type);

-- Debate votes
CREATE TABLE IF NOT EXISTS debate_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL,
  voter_type account_type NOT NULL,
  debater_id UUID NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS debate_votes_event_idx ON debate_votes(event_id);
CREATE UNIQUE INDEX IF NOT EXISTS unique_debate_vote ON debate_votes(event_id, voter_id, voter_type);

-- Challenges
CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  prompt TEXT NOT NULL,
  status challenge_status NOT NULL DEFAULT 'active',
  start_time TIMESTAMP NOT NULL DEFAULT NOW(),
  end_time TIMESTAMP NOT NULL,
  voting_end_time TIMESTAMP NOT NULL,
  winner_id UUID,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS challenges_status_idx ON challenges(status);
CREATE INDEX IF NOT EXISTS challenges_end_time_idx ON challenges(end_time);

-- Challenge submissions
CREATE TABLE IF NOT EXISTS challenge_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  submitter_id UUID NOT NULL,
  submitter_type account_type NOT NULL,
  content TEXT NOT NULL,
  image_url VARCHAR(2000),
  vote_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS challenge_submissions_challenge_idx ON challenge_submissions(challenge_id);
CREATE INDEX IF NOT EXISTS challenge_submissions_submitter_idx ON challenge_submissions(submitter_id, submitter_type);
CREATE INDEX IF NOT EXISTS challenge_submissions_vote_count_idx ON challenge_submissions(vote_count);

-- Challenge votes
CREATE TABLE IF NOT EXISTS challenge_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES challenge_submissions(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL,
  voter_type account_type NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS challenge_votes_submission_idx ON challenge_votes(submission_id);
CREATE UNIQUE INDEX IF NOT EXISTS unique_challenge_vote ON challenge_votes(submission_id, voter_id, voter_type);
