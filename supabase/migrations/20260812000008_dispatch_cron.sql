-- ScanV: pg_cron job — invoke booking-dispatch tick every minute (2-min retry gaps)

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Calls booking-dispatch {"action":"tick"} using auth from Vault (see scripts/setup-dispatch-cron.sql)
CREATE OR REPLACE FUNCTION public.scanv_dispatch_tick_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  auth_header text;
  dispatch_secret text;
  service_role text;
  fn_url text := 'https://rwlwrmmqtedugcreweut.supabase.co/functions/v1/booking-dispatch';
BEGIN
  SELECT decrypted_secret INTO dispatch_secret
  FROM vault.decrypted_secrets WHERE name = 'scanv_dispatch_secret' LIMIT 1;

  SELECT decrypted_secret INTO service_role
  FROM vault.decrypted_secrets WHERE name = 'scanv_service_role_key' LIMIT 1;

  IF dispatch_secret IS NOT NULL THEN
    PERFORM net.http_post(
      url := fn_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-dispatch-secret', dispatch_secret
      ),
      body := '{"action":"tick"}'::jsonb,
      timeout_milliseconds := 30000
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
      body := '{"action":"tick"}'::jsonb,
      timeout_milliseconds := 30000
    );
    RETURN;
  END IF;

  RAISE WARNING 'scanv_dispatch_tick_cron: no vault secret — run scripts/setup-dispatch-cron.sql';
END;
$$;

-- Reschedule idempotently
DO $$
DECLARE
  job_id bigint;
BEGIN
  SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'scanv-dispatch-tick';
  IF job_id IS NOT NULL THEN
    PERFORM cron.unschedule(job_id);
  END IF;
END $$;

SELECT cron.schedule(
  'scanv-dispatch-tick',
  '* * * * *',
  $$SELECT public.scanv_dispatch_tick_cron();$$
);
