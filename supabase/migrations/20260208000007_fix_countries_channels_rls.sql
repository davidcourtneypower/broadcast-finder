-- Allow authenticated users to manage countries and channels (admin panel)

-- Countries: allow authenticated users to insert and delete
CREATE POLICY "Authenticated insert countries" ON countries FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated delete countries" ON countries FOR DELETE
  USING (auth.role() = 'authenticated');

-- Country channels: allow authenticated users to insert and delete
CREATE POLICY "Authenticated insert country_channels" ON country_channels FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated delete country_channels" ON country_channels FOR DELETE
  USING (auth.role() = 'authenticated');

-- api_fetch_logs: ensure RLS is enabled with public read
-- (table may not have RLS enabled from original migration)
ALTER TABLE api_fetch_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read api_fetch_logs" ON api_fetch_logs FOR SELECT USING (true);
CREATE POLICY "Service write api_fetch_logs" ON api_fetch_logs FOR ALL USING (auth.role() = 'service_role');
