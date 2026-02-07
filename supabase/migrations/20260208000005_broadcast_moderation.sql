-- Broadcast moderation: blocked broadcasts table, duplicate prevention, downvote auto-removal

-- 1. blocked_broadcasts table
-- Tracks broadcasts auto-removed by downvote threshold. Prevents re-adding same country+channel to a fixture.
CREATE TABLE IF NOT EXISTS blocked_broadcasts (
  id SERIAL PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  country TEXT NOT NULL,
  channel TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT 'downvote_threshold',
  blocked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS blocked_broadcasts_match_country_channel_unique
  ON blocked_broadcasts(match_id, LOWER(country), LOWER(channel));

ALTER TABLE blocked_broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read blocked_broadcasts" ON blocked_broadcasts FOR SELECT USING (true);
CREATE POLICY "Service write blocked_broadcasts" ON blocked_broadcasts FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Authenticated delete blocked_broadcasts" ON blocked_broadcasts FOR DELETE
  USING (auth.role() = 'authenticated');

-- 2. Unique constraint on broadcasts (server-side duplicate prevention)
-- Prevents same country+channel combo from being added to a fixture twice
CREATE UNIQUE INDEX IF NOT EXISTS broadcasts_match_country_channel_unique
  ON broadcasts(match_id, LOWER(country), LOWER(channel));

-- 3. Downvote threshold trigger
-- When a downvote is inserted and count reaches 10, auto-delete the broadcast and block it
CREATE OR REPLACE FUNCTION check_downvote_threshold()
RETURNS TRIGGER AS $$
DECLARE
  downvote_count INTEGER;
  threshold INTEGER := 10;
  bc RECORD;
BEGIN
  IF NEW.vote_type != 'down' THEN RETURN NULL; END IF;

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

CREATE TRIGGER trg_check_downvote_threshold
  AFTER INSERT ON votes
  FOR EACH ROW EXECUTE FUNCTION check_downvote_threshold();
