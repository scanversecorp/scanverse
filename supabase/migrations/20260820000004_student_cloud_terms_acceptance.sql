-- Cloud candidate terms acceptance timestamp (SGR / student_cloud)
ALTER TABLE public.student_cloud
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_version TEXT;

COMMENT ON COLUMN public.student_cloud.terms_accepted_at IS 'When candidate manually accepted Terms before SGR submit';
COMMENT ON COLUMN public.student_cloud.terms_version IS 'Version of Terms accepted (e.g. 2026-08-20)';
