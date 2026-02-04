-- Add source tracking columns to broadcasts table
ALTER TABLE broadcasts
ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'user',
ADD COLUMN IF NOT EXISTS source_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS confidence_score INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;

-- Add comments for clarity
COMMENT ON COLUMN broadcasts.source IS 'Source of broadcast data: user, livesoccertv, api-football, etc';
COMMENT ON COLUMN broadcasts.source_id IS 'External ID from source system if applicable';
COMMENT ON COLUMN broadcasts.confidence_score IS 'Confidence score 0-100, increased by upvotes';
COMMENT ON COLUMN broadcasts.last_verified_at IS 'Last time data was verified by user vote';

-- Create index for efficient cache lookups
CREATE INDEX IF NOT EXISTS idx_broadcasts_source_created
ON broadcasts(match_id, source, created_at DESC);

-- Create index for finding recently verified broadcasts
CREATE INDEX IF NOT EXISTS idx_broadcasts_verified
ON broadcasts(last_verified_at DESC)
WHERE last_verified_at IS NOT NULL;

-- Update existing broadcasts to have proper source
UPDATE broadcasts
SET source = 'user'
WHERE source IS NULL;
