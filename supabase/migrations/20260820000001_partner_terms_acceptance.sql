-- Partner Terms acceptance timestamp at onboarding
ALTER TABLE public.vendor_partners
  ADD COLUMN IF NOT EXISTS partner_terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS partner_terms_version TEXT;

COMMENT ON COLUMN public.vendor_partners.partner_terms_accepted_at IS 'When partner accepted Partner Terms at onboarding (required each session)';
COMMENT ON COLUMN public.vendor_partners.partner_terms_version IS 'Version string of Partner Terms accepted (e.g. 2026-08-20)';
