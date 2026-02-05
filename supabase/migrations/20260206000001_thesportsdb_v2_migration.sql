-- TheSportsDB V2 Migration
-- Adds sportsdb_event_id column for direct event matching between fixtures and broadcasts

-- Add TheSportsDB event ID column for direct broadcast matching
ALTER TABLE matches ADD COLUMN IF NOT EXISTS sportsdb_event_id VARCHAR(50);

-- Unique index for upsert operations on sportsdb_event_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_sportsdb_event_id
ON matches(sportsdb_event_id) WHERE sportsdb_event_id IS NOT NULL;

-- Sport name index for efficient querying (all sports now dynamic)
CREATE INDEX IF NOT EXISTS idx_matches_sport_date
ON matches(sport, match_date);

-- Comment on new column
COMMENT ON COLUMN matches.sportsdb_event_id IS 'TheSportsDB event ID for direct broadcast matching';
