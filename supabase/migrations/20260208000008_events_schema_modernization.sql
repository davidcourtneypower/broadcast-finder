-- Schema modernization: matches → events, support non-traditional sports
-- This migration renames tables/columns and adds support for non-team sports
-- Data in votes, broadcasts, blocked_broadcasts, and matches is truncated

-- ============================================================
-- 1. Add sport_type to sports table, remove unused columns
-- ============================================================

-- Add sport type classification
ALTER TABLE sports ADD COLUMN IF NOT EXISTS sport_type TEXT NOT NULL DEFAULT 'team'
  CHECK (sport_type IN ('team', '1v1', 'multi_participant'));

-- Remove unused columns (status calc is now server-driven + app_config)
ALTER TABLE sports DROP COLUMN IF EXISTS duration_minutes;
ALTER TABLE sports DROP COLUMN IF EXISTS pregame_window_minutes;

-- Seed sport types for known sports
UPDATE sports SET sport_type = '1v1' WHERE name IN (
  'Boxing', 'MMA', 'Tennis', 'Fighting', 'Snooker', 'Darts',
  'Badminton', 'Table Tennis', 'Fencing', 'Wrestling'
);
UPDATE sports SET sport_type = 'multi_participant' WHERE name IN (
  'Golf', 'Motorsport', 'Olympics', 'Cycling', 'Skiing',
  'Wintersports', 'Skating', 'Athletics', 'Swimming', 'Sailing'
);

-- ============================================================
-- 2. Truncate data from dependent tables
-- ============================================================

TRUNCATE TABLE votes, broadcasts, blocked_broadcasts, matches CASCADE;

-- ============================================================
-- 3. Rename matches → events, update columns
-- ============================================================

-- Remove from realtime publication before rename
ALTER PUBLICATION supabase_realtime DROP TABLE matches;

-- Rename table
ALTER TABLE matches RENAME TO events;

-- Rename columns
ALTER TABLE events RENAME COLUMN match_date TO event_date;
ALTER TABLE events RENAME COLUMN match_time TO event_time;
ALTER TABLE events RENAME COLUMN last_livescore_update TO last_live_update;

-- Make home/away nullable for non-team sports
ALTER TABLE events ALTER COLUMN home DROP NOT NULL;
ALTER TABLE events ALTER COLUMN away DROP NOT NULL;

-- Add event_name for non-team sports display
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_name TEXT;

-- Add sport_id FK (NOT NULL — table is empty after truncation)
ALTER TABLE events ADD COLUMN IF NOT EXISTS sport_id INTEGER NOT NULL REFERENCES sports(id);

-- Drop the old denormalized sport column (replaced by sport_id FK)
ALTER TABLE events DROP COLUMN sport;

-- Rename trigger
ALTER TRIGGER trg_matches_updated_at ON events RENAME TO trg_events_updated_at;

-- Re-add to realtime publication with new name
ALTER PUBLICATION supabase_realtime ADD TABLE events;

-- ============================================================
-- 4. Rename indexes on events table
-- ============================================================

-- Drop old indexes
DROP INDEX IF EXISTS idx_matches_sport;
DROP INDEX IF EXISTS idx_matches_date;
DROP INDEX IF EXISTS idx_matches_status;
DROP INDEX IF EXISTS idx_matches_sport_date_status;
DROP INDEX IF EXISTS idx_matches_sport_date;

-- Recreate with new names using sport_id
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_sport_id ON events(sport_id);
CREATE INDEX IF NOT EXISTS idx_events_sport_id_date_status ON events(sport_id, event_date, status);
CREATE INDEX IF NOT EXISTS idx_events_sport_id_date ON events(sport_id, event_date);

-- sportsdb_event_id index keeps its name (already event-centric)

-- ============================================================
-- 5. Update related tables: broadcasts and blocked_broadcasts
-- ============================================================

-- broadcasts: rename match_id → event_id
ALTER TABLE broadcasts RENAME COLUMN match_id TO event_id;

-- blocked_broadcasts: rename match_id → event_id
ALTER TABLE blocked_broadcasts RENAME COLUMN match_id TO event_id;

-- admin_action_logs: rename match_id → event_id
ALTER TABLE admin_action_logs RENAME COLUMN match_id TO event_id;

-- Drop old unique indexes and recreate with new names
DROP INDEX IF EXISTS broadcasts_match_country_channel_unique;
CREATE UNIQUE INDEX IF NOT EXISTS broadcasts_event_country_channel_unique
  ON broadcasts(event_id, LOWER(country), LOWER(channel));

DROP INDEX IF EXISTS blocked_broadcasts_match_country_channel_unique;
CREATE UNIQUE INDEX IF NOT EXISTS blocked_broadcasts_event_country_channel_unique
  ON blocked_broadcasts(event_id, LOWER(country), LOWER(channel));

-- Rename match_id index on broadcasts
DROP INDEX IF EXISTS idx_broadcasts_match_id;
CREATE INDEX IF NOT EXISTS idx_broadcasts_event_id ON broadcasts(event_id);

-- Recreate source tracking index with new column name
DROP INDEX IF EXISTS idx_broadcasts_source_created;
CREATE INDEX IF NOT EXISTS idx_broadcasts_source_created ON broadcasts(event_id, source, created_at DESC);

DROP INDEX IF EXISTS idx_broadcasts_unique_source;
CREATE UNIQUE INDEX IF NOT EXISTS idx_broadcasts_unique_source
  ON broadcasts(event_id, channel, country, source) WHERE source IS NOT NULL;

-- ============================================================
-- 6. Update RLS policies to use new table names
-- ============================================================

-- Events table: drop and recreate policy with updated name
DROP POLICY IF EXISTS "Matches are viewable by everyone" ON events;
CREATE POLICY "Events are viewable by everyone" ON events FOR SELECT USING (true);

-- ============================================================
-- 7. Update check_downvote_threshold() function
-- ============================================================

CREATE OR REPLACE FUNCTION check_downvote_threshold()
RETURNS TRIGGER AS $$
DECLARE
  downvote_count INTEGER;
  threshold INTEGER;
  bc RECORD;
BEGIN
  IF NEW.vote_type != 'down' THEN RETURN NULL; END IF;

  SELECT COALESCE(value::int, 10) INTO threshold
    FROM app_config WHERE key = 'downvote_threshold';
  IF threshold IS NULL THEN threshold := 10; END IF;

  SELECT COUNT(*) INTO downvote_count
    FROM votes WHERE broadcast_id = NEW.broadcast_id AND vote_type = 'down';

  IF downvote_count >= threshold THEN
    SELECT event_id, country, channel INTO bc
      FROM broadcasts WHERE id = NEW.broadcast_id;
    IF bc IS NOT NULL THEN
      INSERT INTO blocked_broadcasts (event_id, country, channel, reason)
        VALUES (bc.event_id, bc.country, bc.channel, 'downvote_threshold')
        ON CONFLICT (event_id, LOWER(country), LOWER(channel)) DO NOTHING;
      DELETE FROM broadcasts WHERE id = NEW.broadcast_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 8. Update update_matches_updated_at() → update_events_updated_at()
-- ============================================================

CREATE OR REPLACE FUNCTION update_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update trigger to use renamed function
DROP TRIGGER IF EXISTS trg_events_updated_at ON events;
CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_events_updated_at();

-- Drop old function
DROP FUNCTION IF EXISTS update_matches_updated_at();

-- ============================================================
-- 9. Update app_config cron job keys
-- ============================================================

UPDATE app_config SET key = 'cron_fetch_events' WHERE key = 'cron_fetch_sports';
UPDATE app_config SET key = 'cron_fetch_livestatus' WHERE key = 'cron_fetch_livescores';

-- ============================================================
-- 10. Update cron jobs to call renamed functions
-- ============================================================

-- Remove old cron jobs (ignore if they don't exist)
DO $$ BEGIN
  PERFORM cron.unschedule('fetch-sports-hourly');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  PERFORM cron.unschedule('fetch-livescores-every-2-min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Recreate with new function names
SELECT cron.schedule(
  'fetch-events-hourly',
  '0 * * * *',
  $$ SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
           || '/functions/v1/fetch-events',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{"trigger":"scheduled"}'::jsonb
  ) AS request_id; $$
);

SELECT cron.schedule(
  'fetch-livestatus-every-2-min',
  '*/2 * * * *',
  $$ SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
           || '/functions/v1/fetch-livestatus',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{"trigger":"scheduled"}'::jsonb
  ) AS request_id; $$
);
