-- One-time: pg_cron auth for health-report edge function
-- Run in Supabase Dashboard → SQL Editor AFTER setting edge secret:
--   npx supabase secrets set HEALTH_REPORT_SECRET=your-secret-here
--
-- Replace YOUR_HEALTH_REPORT_SECRET below with the SAME value, then run once.

SELECT vault.create_secret(
  'YOUR_HEALTH_REPORT_SECRET',
  'scanv_health_report_secret',
  'ScanV health-report cron auth'
);

-- Verify cron jobs exist:
-- SELECT jobid, jobname, schedule FROM cron.job
-- WHERE jobname IN ('scanv-health-report-am', 'scanv-health-report-pm');

-- Manual test (runs checks + attempts email via Resend):
-- SELECT public.scanv_health_report_cron('morning');
