-- Migration: Add User Preferences
-- Date: 2026-02-04
-- Description: Adds a JSONB column to user_profiles for storing user preferences

-- Add preferences column to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;

-- Create an index on preferences for better query performance
-- This allows efficient queries like: WHERE preferences->>'timezone' = 'America/New_York'
CREATE INDEX IF NOT EXISTS idx_user_profiles_preferences ON user_profiles USING GIN (preferences);

-- Add comment explaining the preferences structure
COMMENT ON COLUMN user_profiles.preferences IS
'User preferences stored as JSONB. Example structure:
{
  "timezone": "America/New_York",
  "theme": "dark",
  "notifications": {
    "email": true,
    "push": false
  },
  "display": {
    "dateFormat": "MM/DD/YYYY",
    "timeFormat": "12h"
  }
}';

-- Example: Set default preferences for existing users
UPDATE user_profiles
SET preferences = '{
  "timezone": "UTC",
  "timeFormat": "24h"
}'::jsonb
WHERE preferences IS NULL OR preferences = '{}'::jsonb;
