-- One-time setup: store dispatch cron auth in Supabase Vault
-- Run in Supabase Dashboard → SQL Editor (replace values below)

-- Option A (recommended): same value as DISPATCH_SECRET edge function secret
SELECT vault.create_secret(
  'ScanV2026',                    -- ← your DISPATCH_SECRET value
  'scanv_dispatch_secret',
  'ScanV booking-dispatch cron auth'
);

-- Option B: use service role key instead (Project Settings → API → service_role)
-- SELECT vault.create_secret(
--   'eyJhbG...your-service-role-key...',
--   'scanv_service_role_key',
--   'ScanV cron service role auth'
-- );

-- Verify cron job exists:
-- SELECT jobid, jobname, schedule, command FROM cron.job WHERE jobname = 'scanv-dispatch-tick';

-- Manual test (should return HTTP 200 from edge function):
-- SELECT public.scanv_dispatch_tick_cron();

-- View recent cron runs:
-- SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'scanv-dispatch-tick') ORDER BY start_time DESC LIMIT 5;
