-- Optional vehicle registration for delivery / two-wheeler / four-wheeler partners
ALTER TABLE vendor_partners
  ADD COLUMN IF NOT EXISTS vehicle_number TEXT;

CREATE INDEX IF NOT EXISTS idx_vendor_partners_vehicle
  ON vendor_partners(vehicle_number)
  WHERE vehicle_number IS NOT NULL;
