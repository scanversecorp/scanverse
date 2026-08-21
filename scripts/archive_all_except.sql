-- Archive all customer/partner profiles and offboard vendors except 8484850288 + admins.
-- Auth login revoke: run scripts/archive-all-except.mjs after deploying admin-hub (revokes GoTrue).
-- Or delete @scanv.app auth users manually for archived mobiles.

BEGIN;

UPDATE public.profiles
SET
  status = 'deleted',
  mobile_verified = false,
  mobile_verified_at = NULL
WHERE role IS DISTINCT FROM 'admin'
  AND id <> 'cust_8484850288'
  AND COALESCE(right(regexp_replace(COALESCE(phone, ''), '\D', '', 'g'), 10), '') <> '8484850288'
  AND status IS DISTINCT FROM 'deleted';

UPDATE public.vendor_partners
SET
  status = 'offboarded',
  offboarded_at = COALESCE(offboarded_at, now())
WHERE status IS DISTINCT FROM 'offboarded'
  AND COALESCE(profile_id, '') <> 'cust_8484850288'
  AND COALESCE(right(regexp_replace(COALESCE(phone, ''), '\D', '', 'g'), 10), '') <> '8484850288';

COMMIT;
