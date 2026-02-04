-- Migration: Add Supabase Auth Integration
-- Date: 2026-02-04
-- Description: Updates schema to use Supabase Auth users and adds RLS policies

-- Create user_profiles table to store additional user information
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read all profiles
CREATE POLICY "Public profiles are viewable by everyone"
  ON user_profiles FOR SELECT
  USING (true);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Policy: Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Drop the old user_id index on votes (if it exists)
DROP INDEX IF EXISTS idx_votes_user_id;

-- Temporarily disable foreign key constraint on votes
ALTER TABLE votes DROP CONSTRAINT IF EXISTS votes_broadcast_id_fkey;

-- Alter votes table to use UUID for user_id
-- First, create a new column
ALTER TABLE votes ADD COLUMN IF NOT EXISTS user_id_uuid UUID;

-- Re-add the foreign key constraint for broadcast_id
ALTER TABLE votes
  ADD CONSTRAINT votes_broadcast_id_fkey
  FOREIGN KEY (broadcast_id)
  REFERENCES broadcasts(id)
  ON DELETE CASCADE;

-- Drop the old unique constraint
ALTER TABLE votes DROP CONSTRAINT IF EXISTS votes_broadcast_id_user_id_key;

-- Add new unique constraint with UUID
ALTER TABLE votes ADD CONSTRAINT votes_broadcast_id_user_id_uuid_key UNIQUE(broadcast_id, user_id_uuid);

-- Create index on new user_id_uuid column
CREATE INDEX idx_votes_user_id_uuid ON votes(user_id_uuid);

-- Enable RLS on votes
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read votes
CREATE POLICY "Votes are viewable by everyone"
  ON votes FOR SELECT
  USING (true);

-- Policy: Authenticated users can insert votes
CREATE POLICY "Authenticated users can insert votes"
  ON votes FOR INSERT
  WITH CHECK (auth.uid() = user_id_uuid);

-- Policy: Users can update their own votes
CREATE POLICY "Users can update own votes"
  ON votes FOR UPDATE
  USING (auth.uid() = user_id_uuid);

-- Policy: Users can delete their own votes
CREATE POLICY "Users can delete own votes"
  ON votes FOR DELETE
  USING (auth.uid() = user_id_uuid);

-- Alter broadcasts table to use UUID for created_by
-- First, create a new column
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS created_by_uuid UUID;

-- Enable RLS on broadcasts
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read broadcasts
CREATE POLICY "Broadcasts are viewable by everyone"
  ON broadcasts FOR SELECT
  USING (true);

-- Policy: Authenticated users can insert broadcasts
CREATE POLICY "Authenticated users can insert broadcasts"
  ON broadcasts FOR INSERT
  WITH CHECK (auth.uid() = created_by_uuid);

-- Policy: Users can update their own broadcasts
CREATE POLICY "Users can update own broadcasts"
  ON broadcasts FOR UPDATE
  USING (auth.uid() = created_by_uuid);

-- Policy: Users can delete their own broadcasts
CREATE POLICY "Users can delete own broadcasts"
  ON broadcasts FOR DELETE
  USING (auth.uid() = created_by_uuid);

-- Enable RLS on matches (read-only for regular users)
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read matches
CREATE POLICY "Matches are viewable by everyone"
  ON matches FOR SELECT
  USING (true);

-- Add comments for documentation
COMMENT ON TABLE user_profiles IS 'Extended user profile information linked to Supabase Auth users';
COMMENT ON COLUMN votes.user_id_uuid IS 'UUID reference to auth.users (replaces user_id)';
COMMENT ON COLUMN broadcasts.created_by_uuid IS 'UUID reference to auth.users (replaces created_by)';

-- Note: Keep old user_id and created_by columns temporarily for migration purposes
-- They can be dropped after data migration if needed
