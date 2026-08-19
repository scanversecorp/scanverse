-- Contact email + user-chosen password tracking (auth still uses @scanv.app synthetic email)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMPTZ;

ALTER TABLE public.vendor_partners
  ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.contact_email IS 'User-provided contact email collected at onboarding';
COMMENT ON COLUMN public.profiles.password_set_at IS 'When user set a login password (OTP only needed after logout or forgot password)';
