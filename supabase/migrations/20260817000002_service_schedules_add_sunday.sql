-- Add Sunday (day 0) 9:00–19:00 IST to all existing service schedule windows.

UPDATE public.service_schedules
SET
  windows = windows || '[{"day":0,"start":"09:00","end":"19:00"}]'::jsonb,
  updated_at = now(),
  updated_by = 'migration'
WHERE NOT EXISTS (
  SELECT 1
  FROM jsonb_array_elements(windows) w
  WHERE (w->>'day')::int = 0
);
