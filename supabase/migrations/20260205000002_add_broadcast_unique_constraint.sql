-- Add unique constraint for broadcast deduplication from automated sources
-- This prevents duplicate broadcasts when the same source reports the same channel multiple times

-- Add unique constraint on match_id, channel, country, source combination
-- Using partial index (WHERE source IS NOT NULL) to only apply to source-tracked broadcasts
CREATE UNIQUE INDEX IF NOT EXISTS idx_broadcasts_unique_source
ON broadcasts(match_id, channel, country, source)
WHERE source IS NOT NULL;

-- Add index for efficient source-based queries
CREATE INDEX IF NOT EXISTS idx_broadcasts_source
ON broadcasts(source);

-- Add comment for documentation
COMMENT ON INDEX idx_broadcasts_unique_source IS 'Prevents duplicate broadcasts from the same automated source';
