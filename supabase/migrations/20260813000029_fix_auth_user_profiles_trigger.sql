-- Fix auth.users → profiles trigger: ScanV often creates cust_* profiles before GoTrue signup.
-- Without ON CONFLICT, admin.createUser / signUp fails with profiles_email_key violation.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cust_id text;
  local_part text;
BEGIN
  local_part := lower(trim(split_part(coalesce(NEW.email, ''), '@', 1)));
  cust_id := 'cust_' || right(regexp_replace(local_part, '\D', '', 'g'), 10);

  IF cust_id !~ '^cust_[0-9]{10}$' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, email, role, status, created_at)
  VALUES (cust_id, lower(trim(NEW.email)), 'customer', 'active', now())
  ON CONFLICT (email) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    RETURN NEW;
  WHEN OTHERS THEN
    -- Never block auth signup for profile side-effects
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user IS
  'Auth signup hook: ensure cust_* profile exists; skip if email already registered in profiles';
