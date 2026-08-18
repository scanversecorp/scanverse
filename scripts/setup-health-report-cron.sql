-- One-time setup: health report cron auth + verify schedule
-- Run in Supabase Dashboard → SQL Editor

-- 1) Store cron auth secret (same value as HEALTH_REPORT_SECRET edge function secret)
SELECT vault.create_secret(
  'REPLACE_WITH_STRONG_SECRET',   -- ← match npx supabase secrets set HEALTH_REPORT_SECRET=...
  'scanv_health_report_secret',
  'ScanV health-report cron auth'
);

-- Option B: reuse existing service role vault entry from dispatch cron
-- (scanv_service_role_key — no extra secret needed if already set)

-- 2) Verify cron jobs
-- SELECT jobid, jobname, schedule, command FROM cron.job
-- WHERE jobname IN ('scanv-health-report-am', 'scanv-health-report-pm');

-- 3) Manual test (morning report — sends email if Resend configured)
-- SELECT public.scanv_health_report_cron('morning');

-- 4) Manual test (evening report)
-- SELECT public.scanv_health_report_cron('evening');

-- Schedule reference:
--   scanv-health-report-am  → 30 0 * * * UTC  → 6:00 AM IST every day
--   scanv-health-report-pm  → 30 11 * * * UTC → 5:00 PM IST every day
