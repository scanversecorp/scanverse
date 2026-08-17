-- Fix Supabase advisor: RLS must not trust auth user_metadata (user-editable).
-- Leader access for visitor_sessions / qr_scans now uses profiles.role via auth_is_admin().

DROP POLICY IF EXISTS vs_leader ON public.visitor_sessions;
DROP POLICY IF EXISTS qr_leader ON public.qr_scans;

CREATE POLICY vs_leader ON public.visitor_sessions
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

CREATE POLICY qr_leader ON public.qr_scans
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

COMMENT ON POLICY vs_leader ON public.visitor_sessions IS
  'Admin hub: leader read/write visitor analytics (profiles.role=admin, not user_metadata).';
COMMENT ON POLICY qr_leader ON public.qr_scans IS
  'Admin hub: leader read/write QR scan analytics (profiles.role=admin, not user_metadata).';
