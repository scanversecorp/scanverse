-- Fix profiles INSERT/UPDATE RLS during customer signup.
-- Root cause: auth_can_insert_profile (migration 28) required exact JWT email match and
-- derived cust_* from email local-part; legacy auth emails like 918484850288@scanv.app
-- produce cust_484850288 while the app inserts cust_8484850288 → RLS WITH CHECK fails.

CREATE OR REPLACE FUNCTION public.auth_email_mobile10()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT right(
    regexp_replace(
      split_part(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), '@', 1),
      '\D', '', 'g'
    ),
    10
  );
$$;

CREATE OR REPLACE FUNCTION public.profile_id_from_mobile10(m10 text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN m10 ~ '^[0-9]{10}$' THEN 'cust_' || m10
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.auth_profile_id_from_jwt()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.profile_id_from_mobile10(public.auth_email_mobile10());
$$;

CREATE OR REPLACE FUNCTION public.emails_match_scanv_mobile(profile_email text, jwt_email text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    profile_email IS NOT NULL
    AND jwt_email IS NOT NULL
    AND right(regexp_replace(split_part(lower(trim(profile_email)), '@', 1), '\D', '', 'g'), 10)
      = right(regexp_replace(split_part(lower(trim(jwt_email)), '@', 1), '\D', '', 'g'), 10)
    AND right(regexp_replace(split_part(lower(trim(jwt_email)), '@', 1), '\D', '', 'g'), 10) ~ '^[0-9]{10}$';
$$;

CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM public.profiles p
  WHERE lower(trim(p.email)) = lower(trim(auth.jwt() ->> 'email'))
     OR public.emails_match_scanv_mobile(p.email, auth.jwt() ->> 'email')
  ORDER BY (p.id = public.auth_profile_id_from_jwt()) DESC, p.created_at ASC NULLS LAST
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
    OR profile_id = public.auth_profile_id_from_jwt()
  );
$$;

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
    AND profile_id ~ '^cust_[0-9]{10}$'
    AND profile_id = public.auth_profile_id_from_jwt()
    AND public.emails_match_scanv_mobile(profile_email, auth.jwt() ->> 'email');
$$;

DROP POLICY IF EXISTS profiles_own_insert ON public.profiles;
CREATE POLICY profiles_own_insert ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.auth_matches_profile(id)
    OR public.auth_can_insert_profile(id, email)
  );

COMMENT ON FUNCTION public.auth_email_mobile10 IS
  'Last 10 digits from JWT @scanv.app email local-part (handles +91 prefix variants)';
COMMENT ON FUNCTION public.auth_can_insert_profile IS
  'RLS: first registration when JWT mobile10 matches cust_* id and profile email';
