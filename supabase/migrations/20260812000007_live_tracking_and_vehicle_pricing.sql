-- Live vendor/partner GPS tracking until booking is closed

CREATE TABLE IF NOT EXISTS vendor_live_locations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id       TEXT NOT NULL UNIQUE,
  vendor_id        UUID REFERENCES vendor_partners(id) ON DELETE SET NULL,
  partner_id       TEXT,
  lat              DOUBLE PRECISION NOT NULL,
  lng              DOUBLE PRECISION NOT NULL,
  heading          DOUBLE PRECISION,
  speed_kmh        DOUBLE PRECISION,
  tracking_active  BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_live_booking
  ON vendor_live_locations(booking_id)
  WHERE tracking_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_vendor_live_vendor
  ON vendor_live_locations(vendor_id, updated_at DESC);

ALTER TABLE vendor_live_locations ENABLE ROW LEVEL SECURITY;

-- Pricing seeds for vehicle support sub-services
INSERT INTO service_pricing (
  service_id, card, sub_card, service_name, sub_service_name,
  current_amount_paise, new_amount_paise,
  partner_amount_paise, partner_pct, scanv_amount_paise, scanv_pct
) VALUES
  ('tw-mechanic', 'Two Wheeler', 'Roadside', 'Two Wheeler Support', 'Mechanic Support', 29900, 22400, 15680, 70, 6720, 30),
  ('tw-pickup', 'Two Wheeler', 'Care', 'Two Wheeler Support', 'Pick-up & Drop Servicing', 39900, 29900, 20930, 70, 8970, 30),
  ('tw-fix', 'Two Wheeler', 'Roadside', 'Two Wheeler Support', 'On-Road Fixing', 19900, 14900, 10430, 70, 4470, 30),
  ('tw-wash', 'Two Wheeler', 'Care', 'Two Wheeler Support', 'Bike Washing', 9900, 7400, 5180, 70, 2220, 30),
  ('tw-deep', 'Two Wheeler', 'Care', 'Two Wheeler Support', 'Deep Cleaning', 14900, 11200, 7840, 70, 3360, 30),
  ('tw-battery', 'Two Wheeler', 'Roadside', 'Two Wheeler Support', 'Battery & Tyre Check', 12900, 9700, 6790, 70, 2910, 30),
  ('fw-mechanic', 'Four Wheeler', 'Service', 'Four Wheeler Support', 'Mechanic Support', 49900, 37400, 26180, 70, 11220, 30),
  ('fw-pickup', 'Four Wheeler', 'Care', 'Four Wheeler Support', 'Pick-up & Drop Servicing', 79900, 59900, 41930, 70, 17970, 30),
  ('fw-fix', 'Four Wheeler', 'Service', 'Four Wheeler Support', 'On-Site Fixing', 39900, 29900, 20930, 70, 8970, 30),
  ('fw-wash', 'Four Wheeler', 'Care', 'Four Wheeler Support', 'Car Washing', 19900, 14900, 10430, 70, 4470, 30),
  ('fw-deep', 'Four Wheeler', 'Care', 'Four Wheeler Support', 'Deep Cleaning', 29900, 22400, 15680, 70, 6720, 30),
  ('fw-detail', 'Four Wheeler', 'Care', 'Four Wheeler Support', 'Detailing & Interior', 49900, 37400, 26180, 70, 11220, 30)
ON CONFLICT (service_id) DO NOTHING;
