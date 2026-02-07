-- Add RPC functions for enabling/disabling cron jobs from the admin UI

-- ============================================================
-- 1. get_cron_jobs() – list all cron jobs with their status
-- ============================================================

CREATE OR REPLACE FUNCTION get_cron_jobs()
RETURNS TABLE(jobname TEXT, schedule TEXT, active BOOLEAN) AS $$
BEGIN
  RETURN QUERY SELECT j.jobname::TEXT, j.schedule::TEXT, j.active
    FROM cron.job j
    ORDER BY j.jobname;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. toggle_cron_job() – enable or disable a specific cron job
-- ============================================================

CREATE OR REPLACE FUNCTION toggle_cron_job(job_name TEXT, is_active BOOLEAN)
RETURNS void AS $$
DECLARE
  jid BIGINT;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE cron.job.jobname = job_name;
  IF jid IS NOT NULL THEN
    PERFORM cron.alter_job(jid, active := is_active);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
