-- Add unique constraint for sportsdb_event_id to enable upsert operations
-- The previous migration created an index, but Supabase upsert requires a constraint

-- Drop the existing index if it exists (we'll replace with constraint)
DROP INDEX IF EXISTS idx_matches_sportsdb_event_id;

-- Add unique constraint (this also creates an index)
ALTER TABLE matches
ADD CONSTRAINT matches_sportsdb_event_id_unique
UNIQUE (sportsdb_event_id);
