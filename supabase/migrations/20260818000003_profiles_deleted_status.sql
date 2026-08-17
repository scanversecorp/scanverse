-- Allow admin lifecycle statuses on customer/partner profiles.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check
  CHECK (status IN ('active', 'pending', 'paused', 'suspended', 'deleted'));

COMMENT ON CONSTRAINT profiles_status_check ON public.profiles IS
  'active=normal · pending=signup · paused=admin hold · suspended=blocked · deleted=login revoked, profile kept';
