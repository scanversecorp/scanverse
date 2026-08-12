-- Bookings RLS + fix profile-id auth (cust_*/partner_* TEXT ids vs auth UUID)
-- Migration 24 used auth.uid() which never matches TEXT profile ids.

CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM public.profiles p
  WHERE p.email = (auth.jwt() ->> 'email')
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.auth_matches_profile(profile_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT profile_id IS NOT NULL AND (
    profile_id = auth.uid()::text
    OR profile_id = public.current_profile_id()
  );
$$;

-- Fix dispatch read policies (migration 24)
DROP POLICY IF EXISTS booking_dispatch_customer_select ON booking_dispatch;
CREATE POLICY booking_dispatch_customer_select ON booking_dispatch
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id::text = booking_dispatch.booking_id::text
        AND public.auth_matches_profile(b.customer_id::text)
    )
  );

DROP POLICY IF EXISTS booking_dispatch_partner_select ON booking_dispatch;
CREATE POLICY booking_dispatch_partner_select ON booking_dispatch
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id::text = booking_dispatch.booking_id::text
        AND public.auth_matches_profile(b.partner_id::text)
    )
  );

-- Fix live GPS policies (migration 09)
DROP POLICY IF EXISTS vendor_live_customer_select ON vendor_live_locations;
CREATE POLICY vendor_live_customer_select ON vendor_live_locations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id::text = vendor_live_locations.booking_id::text
        AND public.auth_matches_profile(b.customer_id::text)
    )
  );

DROP POLICY IF EXISTS vendor_live_partner_upsert ON vendor_live_locations;
CREATE POLICY vendor_live_partner_upsert ON vendor_live_locations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id::text = vendor_live_locations.booking_id::text
        AND public.auth_matches_profile(b.partner_id::text)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id::text = vendor_live_locations.booking_id::text
        AND public.auth_matches_profile(b.partner_id::text)
    )
  );

-- Bookings: customer/partner scoped access (partner markComplete needs UPDATE)
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bookings_customer_select ON bookings;
CREATE POLICY bookings_customer_select ON bookings
  FOR SELECT
  TO authenticated
  USING (public.auth_matches_profile(customer_id::text));

DROP POLICY IF EXISTS bookings_partner_select ON bookings;
CREATE POLICY bookings_partner_select ON bookings
  FOR SELECT
  TO authenticated
  USING (public.auth_matches_profile(partner_id::text));

DROP POLICY IF EXISTS bookings_customer_insert ON bookings;
CREATE POLICY bookings_customer_insert ON bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.auth_matches_profile(customer_id::text));

DROP POLICY IF EXISTS bookings_customer_update ON bookings;
CREATE POLICY bookings_customer_update ON bookings
  FOR UPDATE
  TO authenticated
  USING (public.auth_matches_profile(customer_id::text))
  WITH CHECK (public.auth_matches_profile(customer_id::text));

DROP POLICY IF EXISTS bookings_partner_update ON bookings;
CREATE POLICY bookings_partner_update ON bookings
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

GRANT SELECT, INSERT, UPDATE ON bookings TO authenticated;

COMMENT ON FUNCTION public.auth_matches_profile IS
  'RLS helper: TEXT profile id (cust_*/partner_*) via JWT email or legacy auth.uid()';
