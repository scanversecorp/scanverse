-- Allow first-time customer registration under profiles RLS (migration 27).
-- auth_matches_profile requires an existing row; new users need JWT email ↔ cust_* id match.

CREATE OR REPLACE FUNCTION public.auth_can_insert_profile(profile_id text, profile_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    profile_id IS NOT NULL
    AND profile_email IS NOT NULL
    AND (auth.jwt() ->> 'email') IS NOT NULL
    AND lower(trim(profile_email)) = lower(trim(auth.jwt() ->> 'email'))
    AND profile_id = 'cust_' || right(
      regexp_replace(split_part(lower(auth.jwt() ->> 'email'), '@', 1), '\D', '', 'g'),
      10
    )
    AND profile_id ~ '^cust_[0-9]{10}$';
$$;

DROP POLICY IF EXISTS profiles_own_insert ON public.profiles;
CREATE POLICY profiles_own_insert ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.auth_matches_profile(id)
    OR public.auth_can_insert_profile(id, email)
  );

COMMENT ON FUNCTION public.auth_can_insert_profile IS
  'RLS helper: authenticated first registration when JWT email matches cust_* row';
