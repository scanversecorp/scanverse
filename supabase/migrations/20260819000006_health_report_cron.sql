-- ScanV: pg_cron — daily health report emails at 6:00 AM & 5:00 PM IST
-- 6:00 AM IST = 00:30 UTC | 5:00 PM IST = 11:30 UTC

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.scanv_health_report_cron(p_slot text DEFAULT 'morning')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  auth_header text;
  report_secret text;
  service_role text;
  fn_url text := 'https://rwlwrmmqtedugcreweut.supabase.co/functions/v1/health-report';
  slot text := CASE WHEN lower(coalesce(p_slot, 'morning')) = 'evening' THEN 'evening' ELSE 'morning' END;
BEGIN
  SELECT decrypted_secret INTO report_secret
  FROM vault.decrypted_secrets WHERE name = 'scanv_health_report_secret' LIMIT 1;

  SELECT decrypted_secret INTO service_role
  FROM vault.decrypted_secrets WHERE name = 'scanv_service_role_key' LIMIT 1;

  IF report_secret IS NOT NULL THEN
    PERFORM net.http_post(
      url := fn_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-health-report-secret', report_secret
      ),
      body := jsonb_build_object('slot', slot),
      timeout_milliseconds := 120000
    );
    RETURN;
  END IF;

  IF service_role IS NOT NULL THEN
    auth_header := 'Bearer ' || service_role;
    PERFORM net.http_post(
      url := fn_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', auth_header
      ),
      body := jsonb_build_object('slot', slot),
      timeout_milliseconds := 120000
    );
    RETURN;
  END IF;

  RAISE WARNING 'scanv_health_report_cron: no vault secret — run scripts/setup-health-report-cron.sql';
END;
$$;

DO $$
DECLARE
  job_id bigint;
BEGIN
  SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'scanv-health-report-am';
  IF job_id IS NOT NULL THEN PERFORM cron.unschedule(job_id); END IF;

  SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'scanv-health-report-pm';
  IF job_id IS NOT NULL THEN PERFORM cron.unschedule(job_id); END IF;
END $$;

-- 6:00 AM IST daily (00:30 UTC)
SELECT cron.schedule(
  'scanv-health-report-am',
  '30 0 * * *',
  $$SELECT public.scanv_health_report_cron('morning');$$
);

-- 5:00 PM IST daily (11:30 UTC)
SELECT cron.schedule(
  'scanv-health-report-pm',
  '30 11 * * *',
  $$SELECT public.scanv_health_report_cron('evening');$$
);
