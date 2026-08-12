-- Close anon/public leak on bookings: revoke table grants and drop stray policies.
-- Migration 25 added authenticated-only policies but did not revoke legacy anon SELECT.

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.bookings FROM anon;
REVOKE ALL ON public.bookings FROM public;

GRANT SELECT, INSERT, UPDATE ON public.bookings TO authenticated;

-- Drop any legacy permissive policies (names vary across Supabase dashboard defaults)
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bookings'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.bookings', pol.policyname);
  END LOOP;
END $$;

-- Recreate scoped policies (same as migration 25)
CREATE POLICY bookings_customer_select ON public.bookings
  FOR SELECT
  TO authenticated
  USING (public.auth_matches_profile(customer_id::text));

CREATE POLICY bookings_partner_select ON public.bookings
  FOR SELECT
  TO authenticated
  USING (public.auth_matches_profile(partner_id::text));

CREATE POLICY bookings_customer_insert ON public.bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.auth_matches_profile(customer_id::text));

CREATE POLICY bookings_customer_update ON public.bookings
  FOR UPDATE
  TO authenticated
  USING (public.auth_matches_profile(customer_id::text))
  WITH CHECK (public.auth_matches_profile(customer_id::text));

CREATE POLICY bookings_partner_update ON public.bookings
  FOR UPDATE
  TO authenticated
  USING (
    public.auth_matches_profile(partner_id::text)
    AND status = 'confirmed'
  )
  WITH CHECK (
    public.auth_matches_profile(partner_id::text)
    AND status IN ('confirmed', 'completed')
  );
