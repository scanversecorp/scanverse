-- Staff contact phone for IAM registry (Add user / staff directory)

ALTER TABLE staff_users
  ADD COLUMN IF NOT EXISTS phone TEXT;

CREATE INDEX IF NOT EXISTS idx_staff_users_phone
  ON staff_users (phone)
  WHERE phone IS NOT NULL;

COMMENT ON COLUMN staff_users.phone IS 'Staff contact phone shown in admin directory.';
