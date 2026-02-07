-- Add livescore support: score columns, livescore tracking, and realtime

-- Add score columns (nullable - upcoming matches have no score)
ALTER TABLE matches ADD COLUMN IF NOT EXISTS home_score INTEGER;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS away_score INTEGER;

-- Track when the livescore function last updated this match
-- Used for disappearance detection (marking finished matches)
ALTER TABLE matches ADD COLUMN IF NOT EXISTS last_livescore_update TIMESTAMPTZ;

-- Update column comments to reflect server-managed status
COMMENT ON COLUMN matches.status IS 'Match status: upcoming, live, finished, cancelled. Updated by fetch-livescores edge function.';
COMMENT ON COLUMN matches.home_score IS 'Home team score from TheSportsDB livescore API. NULL for upcoming matches.';
COMMENT ON COLUMN matches.away_score IS 'Away team score from TheSportsDB livescore API. NULL for upcoming matches.';

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION update_matches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_matches_updated_at ON matches;
CREATE TRIGGER trg_matches_updated_at
  BEFORE UPDATE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION update_matches_updated_at();

-- Enable Supabase Realtime on matches table for live status updates
ALTER PUBLICATION supabase_realtime ADD TABLE matches;
