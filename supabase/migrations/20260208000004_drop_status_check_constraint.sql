-- Drop the matches_status_check constraint
-- Status now stores raw TheSportsDB strStatus values (FT, 1H, 2H, HT, NS, etc.)
-- Frontend maps these to display categories via createStatusMapper + status_mappings table

ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_status_check;
