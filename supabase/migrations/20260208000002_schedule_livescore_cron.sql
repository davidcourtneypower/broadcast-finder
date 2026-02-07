-- Schedule livescore fetching every 2 minutes via pg_cron + pg_net

-- Fetch livescores every 2 minutes (24/7)
select cron.schedule(
  'fetch-livescores-every-2-min',
  '*/2 * * * *',
  $$ select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/fetch-livescores',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{"trigger":"scheduled"}'::jsonb
  ) as request_id; $$
);
