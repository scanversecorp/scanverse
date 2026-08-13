-- user_locations had RLS enabled with no policies → all client inserts blocked after signup.

REVOKE ALL ON public.user_locations FROM anon;
REVOKE ALL ON public.user_locations FROM public;
GRANT SELECT, INSERT ON public.user_locations TO authenticated;

DROP POLICY IF EXISTS user_locations_own_select ON public.user_locations;
CREATE POLICY user_locations_own_select ON public.user_locations
  FOR SELECT
  TO authenticated
  USING (public.auth_matches_profile(user_id));

DROP POLICY IF EXISTS user_locations_own_insert ON public.user_locations;
CREATE POLICY user_locations_own_insert ON public.user_locations
  FOR INSERT
  TO authenticated
  WITH CHECK (public.auth_matches_profile(user_id));

COMMENT ON POLICY user_locations_own_insert ON public.user_locations IS
  'Customer GPS consent log — own profile id only';
