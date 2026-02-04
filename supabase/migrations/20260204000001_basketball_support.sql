-- Migration: Add Basketball Support and Update Status Values
-- Date: 2026-02-04
-- Description: Ensures database supports multiple sports and updated status values
-- Note: Status in database is optional - frontend calculates status dynamically
--       based on match_date and match_time for reliability

-- Ensure matches table supports multiple sports
-- (If it doesn't exist, create it. If it does, this is idempotent)
CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  sport TEXT NOT NULL,
  league TEXT NOT NULL,
  home TEXT NOT NULL,
  away TEXT NOT NULL,
  match_date TEXT NOT NULL,
  match_time TEXT NOT NULL,
  country TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming',
  popularity INTEGER NOT NULL DEFAULT 70,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on sport for faster filtering
CREATE INDEX IF NOT EXISTS idx_matches_sport ON matches(sport);

-- Create index on date for faster queries
CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(match_date);

-- Create index on status for live match queries
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);

-- Create composite index for common queries (sport + date + status)
CREATE INDEX IF NOT EXISTS idx_matches_sport_date_status ON matches(sport, match_date, status);

-- Ensure api_fetch_logs table exists
CREATE TABLE IF NOT EXISTS api_fetch_logs (
  id SERIAL PRIMARY KEY,
  fetch_type TEXT NOT NULL,
  sport TEXT NOT NULL,
  fetch_date TEXT NOT NULL,
  status TEXT NOT NULL,
  matches_fetched INTEGER DEFAULT 0,
  matches_created INTEGER DEFAULT 0,
  matches_updated INTEGER DEFAULT 0,
  error_message TEXT,
  api_response_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on sport for api_fetch_logs
CREATE INDEX IF NOT EXISTS idx_api_fetch_logs_sport ON api_fetch_logs(sport);

-- Create index on fetch_date for log queries
CREATE INDEX IF NOT EXISTS idx_api_fetch_logs_date ON api_fetch_logs(fetch_date);

-- Ensure broadcasts table exists
CREATE TABLE IF NOT EXISTS broadcasts (
  id SERIAL PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  country TEXT NOT NULL,
  channel TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on match_id for broadcasts
CREATE INDEX IF NOT EXISTS idx_broadcasts_match_id ON broadcasts(match_id);

-- Ensure votes table exists
CREATE TABLE IF NOT EXISTS votes (
  id SERIAL PRIMARY KEY,
  broadcast_id INTEGER NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(broadcast_id, user_id)
);

-- Create index on broadcast_id for votes
CREATE INDEX IF NOT EXISTS idx_votes_broadcast_id ON votes(broadcast_id);

-- Create index on user_id for user vote queries
CREATE INDEX IF NOT EXISTS idx_votes_user_id ON votes(user_id);

-- Update any existing matches with null or invalid status to 'upcoming'
UPDATE matches
SET status = 'upcoming'
WHERE status IS NULL OR status NOT IN ('upcoming', 'live', 'finished');

-- Add comment to document valid status values
COMMENT ON COLUMN matches.status IS 'Match status: upcoming, live, or finished (optional - frontend calculates dynamically from match_date/match_time)';

-- Add comment to document valid sports
COMMENT ON COLUMN matches.sport IS 'Sport type: Football, Basketball, etc.';

-- Add comment to document valid vote types
COMMENT ON COLUMN votes.vote_type IS 'Vote type: up or down';
