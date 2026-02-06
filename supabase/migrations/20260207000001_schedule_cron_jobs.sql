-- Schedule automated data fetching via pg_cron + pg_net
--
-- PREREQUISITE: You must first add your service role key to vault by running
-- this in the Supabase SQL Editor (replace with your actual key):
--
--   select vault.create_secret('your-service-role-key-here', 'service_role_key');
--

-- Enable required extensions
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Store project URL in vault (safe to include — already public)
select vault.create_secret(
  'https://wgdohslxnbbzttyyqmxa.supabase.co',
  'project_url'
);

-- Fetch fixtures every 1 hour
select cron.schedule(
  'fetch-all-sports-hourly',
  '0 * * * *',
  $$ select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/fetch-all-sports',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{"dates":["today","tomorrow","day_after_tomorrow"],"trigger":"scheduled"}'::jsonb
  ) as request_id; $$
);

-- Fetch broadcasts every 15 minutes
select cron.schedule(
  'fetch-broadcasts-every-15-min',
  '*/15 * * * *',
  $$ select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/fetch-broadcasts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{"dates":["today","tomorrow","day_after_tomorrow"],"trigger":"scheduled"}'::jsonb
  ) as request_id; $$
);

-- Cleanup old data daily at 03:00 UTC
select cron.schedule(
  'cleanup-old-data-daily',
  '0 3 * * *',
  $$ select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/cleanup-old-data',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  ) as request_id; $$
);
