-- Contact email for SGR / student_cloud admissions
ALTER TABLE public.student_cloud
  ADD COLUMN IF NOT EXISTS email TEXT;

COMMENT ON COLUMN public.student_cloud.email IS 'Candidate contact email collected on SGR Form A1';
