-- Close anon/public IDOR on profiles and custom_otp (plaintext OTP table).
-- custom_otp: service role only (send-otp edge function). No client policies.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.profiles FROM public;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.auth_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles me
    WHERE public.auth_matches_profile(me.id)
      AND me.role = 'admin'
  );
$$;

CREATE POLICY profiles_own_select ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.auth_matches_profile(id));

CREATE POLICY profiles_own_insert ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.auth_matches_profile(id));

CREATE POLICY profiles_own_update ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.auth_matches_profile(id))
  WITH CHECK (public.auth_matches_profile(id));

-- Partner/customer name on bookings (App.js live track + booking lists)
CREATE POLICY profiles_booking_counterparty_select ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.partner_id::text = profiles.id
        AND public.auth_matches_profile(b.customer_id::text)
    )
    OR EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.customer_id::text = profiles.id
        AND public.auth_matches_profile(b.partner_id::text)
    )
  );

-- LeaderHome admin counts (customers / partners)
CREATE POLICY profiles_admin_select ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.auth_is_admin());

COMMENT ON FUNCTION public.auth_is_admin IS
  'RLS helper: true when JWT maps to a profiles row with role=admin';

-- ---------------------------------------------------------------------------
-- custom_otp — no client access; send-otp edge fn uses service role
-- ---------------------------------------------------------------------------
ALTER TABLE public.custom_otp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_otp FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.custom_otp FROM anon;
REVOKE ALL ON public.custom_otp FROM public;
REVOKE ALL ON public.custom_otp FROM authenticated;

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'custom_otp'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.custom_otp', pol.policyname);
  END LOOP;
END $$;

-- Intentionally no RLS policies: only service_role bypasses RLS on this table.
