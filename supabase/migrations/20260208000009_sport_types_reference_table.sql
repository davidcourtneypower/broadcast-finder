-- Replace sport_type text column on sports with FK to sport_types table
-- Uses TheSportsDB strFormat values: TeamvsTeam and EventSport

-- ============================================================
-- 1. Create sport_types reference table
-- ============================================================

CREATE TABLE IF NOT EXISTS sport_types (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed the two types (matching TheSportsDB strFormat values)
INSERT INTO sport_types (name) VALUES
  ('TeamvsTeam'),
  ('EventSport')
ON CONFLICT (name) DO NOTHING;

-- Enable RLS
ALTER TABLE sport_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sport types are viewable by everyone" ON sport_types FOR SELECT USING (true);

-- ============================================================
-- 2. Add sport_type_id FK to sports, backfill, drop old column
-- ============================================================

ALTER TABLE sports ADD COLUMN IF NOT EXISTS sport_type_id INTEGER REFERENCES sport_types(id);

-- Backfill from existing text column
UPDATE sports s
  SET sport_type_id = st.id
  FROM sport_types st
  WHERE s.sport_type = st.name;

-- Default any remaining nulls to 'TeamvsTeam'
UPDATE sports
  SET sport_type_id = (SELECT id FROM sport_types WHERE name = 'TeamvsTeam')
  WHERE sport_type_id IS NULL;

-- Make NOT NULL
ALTER TABLE sports ALTER COLUMN sport_type_id SET NOT NULL;

-- Set default for future inserts (TeamvsTeam = id 1, first seeded row)
ALTER TABLE sports ALTER COLUMN sport_type_id SET DEFAULT 1;

-- Drop the old text column and its CHECK constraint
ALTER TABLE sports DROP COLUMN sport_type;
