-- Migration: Enhanced Admin Features
-- Date: 2026-02-05
-- Description: Adds comprehensive admin logging and ban management using user_profiles table

-- Create admin_action_logs table for comprehensive logging
CREATE TABLE IF NOT EXISTS admin_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL, -- 'broadcast_deleted', 'user_banned', 'user_unbanned', 'user_deleted', etc.
  admin_uuid UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_email TEXT,
  target_user_uuid UUID, -- User affected by the action
  target_user_email TEXT,
  broadcast_id UUID, -- For broadcast-related actions
  match_id UUID, -- For match-related actions
  details JSONB, -- Additional details about the action
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on admin_action_logs
ALTER TABLE admin_action_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view action logs
CREATE POLICY "Anyone can view action logs"
  ON admin_action_logs FOR SELECT
  USING (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_action_type ON admin_action_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_admin_uuid ON admin_action_logs(admin_uuid);
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_target_user_uuid ON admin_action_logs(target_user_uuid);
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_created_at ON admin_action_logs(created_at DESC);

-- Add ban tracking columns to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS ban_status BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ban_reason TEXT,
ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS banned_by_uuid UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS banned_by_email TEXT;

-- Create index on ban_status for efficient filtering
CREATE INDEX IF NOT EXISTS idx_user_profiles_ban_status ON user_profiles(ban_status);

-- Add RLS policy to prevent banned users from creating broadcasts
-- (This assumes you want to enforce the ban at the database level)
-- If the policy already exists, this will fail silently
DO $$
BEGIN
  -- Drop existing policy if it exists
  DROP POLICY IF EXISTS "Authenticated users can insert broadcasts" ON broadcasts;

  -- Create new policy that checks ban status
  CREATE POLICY "Authenticated users can insert broadcasts"
    ON broadcasts FOR INSERT
    WITH CHECK (
      auth.uid() = created_by_uuid
      AND NOT EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid()
        AND ban_status = true
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add comments for documentation
COMMENT ON TABLE admin_action_logs IS 'Comprehensive log of all admin actions (bans, deletions, etc.)';
COMMENT ON COLUMN admin_action_logs.action_type IS 'Type of action: broadcast_deleted, user_banned, user_unbanned, user_deleted, etc.';
COMMENT ON COLUMN admin_action_logs.details IS 'JSONB field for additional context like ban_reason, deleted_count, etc.';
COMMENT ON COLUMN user_profiles.ban_status IS 'Whether the user is currently banned';
COMMENT ON COLUMN user_profiles.ban_reason IS 'Reason for ban (if banned)';
COMMENT ON COLUMN user_profiles.banned_at IS 'Timestamp when user was banned';
COMMENT ON COLUMN user_profiles.banned_by_uuid IS 'UUID of admin who banned the user';
COMMENT ON COLUMN user_profiles.banned_by_email IS 'Email of admin who banned the user';
