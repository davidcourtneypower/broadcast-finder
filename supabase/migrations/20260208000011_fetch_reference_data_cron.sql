-- Add fetch-reference-data cron job and app_config entry
-- Runs daily at 04:00 UTC (after cleanup at 03:00 UTC)

-- 1. Add app_config entry for the cron schedule
INSERT INTO app_config (key, value, type, label, category, description) VALUES
  ('cron_fetch_reference_data', '0 4 * * *', 'string',
   'Fetch reference data schedule', 'cron',
   'Cron expression for fetch-reference-data (daily at 04:00 UTC)')
ON CONFLICT (key) DO NOTHING;

-- 2. Schedule the cron job via pg_cron + pg_net
SELECT cron.schedule(
  'fetch-reference-data',
  '0 4 * * *',
  $$ SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
           || '/functions/v1/fetch-reference-data',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{"trigger":"scheduled"}'::jsonb
  ) AS request_id; $$
);
