-- One-time: confirm synthetic @scanv.app auth emails so password sign-in works after OTP verify.
-- Users created before email_confirm was set on updateUserById had email_confirmed_at = null.

UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE lower(email) LIKE '%@scanv.app'
  AND email_confirmed_at IS NULL;
