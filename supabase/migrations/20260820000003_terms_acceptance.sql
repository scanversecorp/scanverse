-- Partner / customer terms acceptance timestamps (manual checkbox + OTP/onboarding)

ALTER TABLE public.vendor_partners
  ADD COLUMN IF NOT EXISTS partner_terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS partner_terms_version TEXT;

COMMENT ON COLUMN public.vendor_partners.partner_terms_accepted_at IS 'When partner manually accepted Partner Terms at onboarding';
COMMENT ON COLUMN public.vendor_partners.partner_terms_version IS 'Version string of Partner Terms accepted (e.g. 2026-08-20)';

ALTER TABLE public.vendor_otp
  ADD COLUMN IF NOT EXISTS partner_terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS partner_terms_version TEXT;

COMMENT ON COLUMN public.vendor_otp.partner_terms_accepted_at IS 'When partner manually accepted terms before this OTP was sent';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_version TEXT;

COMMENT ON COLUMN public.profiles.terms_accepted_at IS 'When customer manually accepted Terms before onboarding/OTP';
COMMENT ON COLUMN public.profiles.terms_version IS 'Version of Terms accepted (e.g. 2026-08-20)';
