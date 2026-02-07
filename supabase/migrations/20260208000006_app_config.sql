-- App configuration table for runtime-adjustable settings
-- Allows admin to change values via UI without code changes or deploys

CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'number',
  label TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read app_config" ON app_config FOR SELECT USING (true);
CREATE POLICY "Authenticated write app_config" ON app_config FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Service write app_config" ON app_config FOR ALL USING (auth.role() = 'service_role');

-- Seed with current hardcoded values
INSERT INTO app_config (key, value, type, label, category, description) VALUES
  -- Frontend
  ('fixtures_per_page',       '20',    'number', 'Fixtures per page',        'frontend',       'Number of fixtures shown initially and per Load More click'),
  ('starting_soon_minutes',   '15',    'number', 'Starting soon (minutes)',   'frontend',       'Minutes before kickoff to show Starting Soon badge'),
  ('status_refresh_seconds',  '60',    'number', 'Status refresh (seconds)',  'frontend',       'Interval for re-evaluating starting-soon on client'),
  -- Moderation
  ('downvote_threshold',      '10',    'number', 'Downvote threshold',        'moderation',     'Number of downvotes to auto-remove and block a broadcast'),
  -- Edge functions
  ('api_timeout_ms',          '30000', 'number', 'API timeout (ms)',          'edge_functions', 'TheSportsDB API request timeout'),
  ('disappearance_minutes',   '5',     'number', 'Disappearance delay (min)', 'edge_functions', 'Minutes before a missing live match is marked finished'),
  ('livescore_batch_size',    '50',    'number', 'Livescore batch size',      'edge_functions', 'Events processed per parallel batch in livescores'),
  -- Cron schedules
  ('cron_fetch_sports',       '0 * * * *',     'string', 'Fetch sports schedule',     'cron', 'Cron expression for fetch-all-sports (hourly)'),
  ('cron_fetch_broadcasts',   '*/15 * * * *',  'string', 'Fetch broadcasts schedule', 'cron', 'Cron expression for fetch-broadcasts (every 15 min)'),
  ('cron_fetch_livescores',   '*/2 * * * *',   'string', 'Fetch livescores schedule', 'cron', 'Cron expression for fetch-livescores (every 2 min)'),
  ('cron_cleanup',            '0 3 * * *',     'string', 'Cleanup schedule',          'cron', 'Cron expression for daily cleanup (03:00 UTC)')
ON CONFLICT (key) DO NOTHING;

-- Update downvote trigger to read threshold from app_config
CREATE OR REPLACE FUNCTION check_downvote_threshold()
RETURNS TRIGGER AS $$
DECLARE
  downvote_count INTEGER;
  threshold INTEGER;
  bc RECORD;
BEGIN
  IF NEW.vote_type != 'down' THEN RETURN NULL; END IF;

  -- Read threshold from app_config, fallback to 10
  SELECT COALESCE(value::int, 10) INTO threshold
    FROM app_config WHERE key = 'downvote_threshold';
  IF threshold IS NULL THEN threshold := 10; END IF;

  SELECT COUNT(*) INTO downvote_count
    FROM votes WHERE broadcast_id = NEW.broadcast_id AND vote_type = 'down';

  IF downvote_count >= threshold THEN
    SELECT match_id, country, channel INTO bc
      FROM broadcasts WHERE id = NEW.broadcast_id;
    IF bc IS NOT NULL THEN
      INSERT INTO blocked_broadcasts (match_id, country, channel, reason)
        VALUES (bc.match_id, bc.country, bc.channel, 'downvote_threshold')
        ON CONFLICT (match_id, LOWER(country), LOWER(channel)) DO NOTHING;
      DELETE FROM broadcasts WHERE id = NEW.broadcast_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper RPC to update cron schedules from admin panel
CREATE OR REPLACE FUNCTION update_cron_schedule(job_name TEXT, new_schedule TEXT)
RETURNS void AS $$
DECLARE
  jid BIGINT;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = job_name;
  IF jid IS NOT NULL THEN
    PERFORM cron.alter_job(jid, schedule := new_schedule);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
