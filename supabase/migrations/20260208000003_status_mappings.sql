-- Status Mappings Table
-- Maps raw TheSportsDB strStatus values to display categories
-- Allows admins to add/edit mappings dynamically without code changes

CREATE TABLE IF NOT EXISTS status_mappings (
  id SERIAL PRIMARY KEY,
  raw_status TEXT NOT NULL UNIQUE,
  display_category TEXT NOT NULL CHECK (display_category IN ('upcoming', 'live', 'finished', 'cancelled')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_mappings_raw_status ON status_mappings(raw_status);
CREATE INDEX IF NOT EXISTS idx_status_mappings_display_category ON status_mappings(display_category);

-- RLS: public read, authenticated write (admin panel gates UI access)
ALTER TABLE status_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Status mappings are viewable by everyone"
  ON status_mappings FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage status mappings"
  ON status_mappings FOR ALL
  USING (true)
  WITH CHECK (auth.role() = 'authenticated');

-- Seed all known TheSportsDB status codes
INSERT INTO status_mappings (raw_status, display_category, description) VALUES
  -- Upcoming
  ('NS', 'upcoming', 'Not started'),
  ('TBD', 'upcoming', 'To be determined'),
  -- Live - Soccer
  ('1H', 'live', 'First half'),
  ('2H', 'live', 'Second half'),
  ('HT', 'live', 'Half time'),
  ('ET', 'live', 'Extra time'),
  ('P', 'live', 'Penalty shootout'),
  ('BT', 'live', 'Break time'),
  -- Live - Basketball / American Football
  ('Q1', 'live', 'Quarter 1'),
  ('Q2', 'live', 'Quarter 2'),
  ('Q3', 'live', 'Quarter 3'),
  ('Q4', 'live', 'Quarter 4'),
  ('OT', 'live', 'Overtime'),
  -- Live - Ice Hockey
  ('P1', 'live', 'Period 1'),
  ('P2', 'live', 'Period 2'),
  ('P3', 'live', 'Period 3'),
  ('PT', 'live', 'Penalty time'),
  -- Live - Baseball
  ('IN1', 'live', 'Inning 1'),
  ('IN2', 'live', 'Inning 2'),
  ('IN3', 'live', 'Inning 3'),
  ('IN4', 'live', 'Inning 4'),
  ('IN5', 'live', 'Inning 5'),
  ('IN6', 'live', 'Inning 6'),
  ('IN7', 'live', 'Inning 7'),
  ('IN8', 'live', 'Inning 8'),
  ('IN9', 'live', 'Inning 9'),
  -- Live - Tennis / Volleyball
  ('S1', 'live', 'Set 1'),
  ('S2', 'live', 'Set 2'),
  ('S3', 'live', 'Set 3'),
  ('S4', 'live', 'Set 4'),
  ('S5', 'live', 'Set 5'),
  -- Finished
  ('FT', 'finished', 'Full time'),
  ('AET', 'finished', 'After extra time'),
  ('AOT', 'finished', 'After overtime'),
  ('PEN', 'finished', 'After penalties'),
  ('AP', 'finished', 'After penalties alt'),
  -- Cancelled / Postponed
  ('CANC', 'cancelled', 'Cancelled'),
  ('PST', 'cancelled', 'Postponed'),
  ('ABD', 'cancelled', 'Abandoned'),
  ('SUSP', 'cancelled', 'Suspended'),
  ('INT', 'cancelled', 'Interrupted'),
  ('INTR', 'cancelled', 'Interrupted alt'),
  ('POST', 'cancelled', 'Postponed alt'),
  ('AWD', 'cancelled', 'Awarded'),
  ('WO', 'cancelled', 'Walkover'),
  ('AW', 'cancelled', 'Awarded alt')
ON CONFLICT (raw_status) DO NOTHING;
