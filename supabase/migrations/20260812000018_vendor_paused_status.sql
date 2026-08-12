-- Add paused status for temporary vendor suspension (excluded from dispatch)

ALTER TABLE vendor_partners DROP CONSTRAINT IF EXISTS vendor_partners_status_check;
ALTER TABLE vendor_partners ADD CONSTRAINT vendor_partners_status_check
  CHECK (status IN ('pending', 'active', 'paused', 'suspended', 'offboarded'));

-- find_nearest_vendors already filters status = 'active'; no change needed
