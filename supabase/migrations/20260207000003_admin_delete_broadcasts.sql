-- Migration: Allow admins to delete any broadcast
-- The existing policy "Users can delete own broadcasts" only allows auth.uid() = created_by_uuid
-- This adds a separate policy for admin users identified by email or user_metadata

CREATE POLICY "Admins can delete any broadcast"
  ON broadcasts FOR DELETE
  USING (
    auth.jwt()->>'email' = 'davidcourtneypower@gmail.com'
    OR (auth.jwt()->'user_metadata'->>'is_admin')::boolean = true
  );
