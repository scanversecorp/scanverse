-- ScanV: Vendor/Partner onboarding + booking dispatch (geo-match + SMS/call/WA retries)

-- ── Vendor partners ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_partners (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  business_name       TEXT NOT NULL,
  contact_name        TEXT NOT NULL,
  phone               TEXT NOT NULL UNIQUE,
  phone_verified      BOOLEAN NOT NULL DEFAULT FALSE,
  email               TEXT,
  pan_number          TEXT,
  pan_verified        BOOLEAN NOT NULL DEFAULT FALSE,
  aadhaar_last4       TEXT,
  aadhaar_verified    BOOLEAN NOT NULL DEFAULT FALSE,
  aadhaar_ekyc_ref    TEXT,
  shop_or_flat        TEXT NOT NULL,
  building_name       TEXT,
  street_name         TEXT NOT NULL,
  village             TEXT,
  city                TEXT NOT NULL,
  pincode             TEXT NOT NULL,
  state               TEXT NOT NULL,
  country             TEXT NOT NULL DEFAULT 'India',
  country_code        TEXT NOT NULL DEFAULT 'IN',
  address_lat         DOUBLE PRECISION,
  address_lng         DOUBLE PRECISION,
  gps_lat             DOUBLE PRECISION,
  gps_lng             DOUBLE PRECISION,
  gps_country         TEXT,
  ip_country          TEXT,
  is_vpn_suspected    BOOLEAN NOT NULL DEFAULT FALSE,
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','active','suspended','offboarded')),
  notes               TEXT,
  onboarded_at        TIMESTAMPTZ,
  offboarded_at       TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_partners_status ON vendor_partners(status);
CREATE INDEX IF NOT EXISTS idx_vendor_partners_geo ON vendor_partners(address_lat, address_lng)
  WHERE status = 'active' AND address_lat IS NOT NULL;

-- ── Services each vendor offers ────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_partner_services (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id    UUID NOT NULL REFERENCES vendor_partners(id) ON DELETE CASCADE,
  service_id   TEXT NOT NULL,
  category_id  TEXT NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(vendor_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_services_lookup
  ON vendor_partner_services(service_id, is_active);

-- ── Vendor onboarding OTP ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_otp (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile      TEXT NOT NULL,
  otp_hash    TEXT NOT NULL,
  purpose     TEXT NOT NULL DEFAULT 'onboard',
  verified    BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_otp_mobile ON vendor_otp(mobile, verified, expires_at);

-- ── Booking dispatch state machine ─────────────────────────────────
CREATE TABLE IF NOT EXISTS booking_dispatch (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id            UUID NOT NULL,
  service_id            TEXT,
  service_name          TEXT NOT NULL,
  customer_lat          DOUBLE PRECISION,
  customer_lng          DOUBLE PRECISION,
  customer_location     TEXT,
  scheduled_date        DATE,
  scheduled_time        TEXT,
  accept_code           TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN (
                          'pending','dispatching','assigned','exhausted','cancelled'
                        )),
  vendor_rank           INT NOT NULL DEFAULT 1,
  attempt_num           INT NOT NULL DEFAULT 1,
  assigned_vendor_id    UUID REFERENCES vendor_partners(id),
  assigned_at           TIMESTAMPTZ,
  accepted_at           TIMESTAMPTZ,
  next_action_at        TIMESTAMPTZ,
  exhausted_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_dispatch_booking
  ON booking_dispatch(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_dispatch_tick
  ON booking_dispatch(next_action_at)
  WHERE status IN ('pending','dispatching');

-- ── Individual notification attempts ───────────────────────────────
CREATE TABLE IF NOT EXISTS booking_dispatch_attempts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id     UUID NOT NULL REFERENCES booking_dispatch(id) ON DELETE CASCADE,
  vendor_id       UUID NOT NULL REFERENCES vendor_partners(id),
  attempt_num     INT NOT NULL DEFAULT 1,
  channel         TEXT NOT NULL
                  CHECK (channel IN ('sms','call','whatsapp_text','whatsapp_call')),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN (
                    'pending','sent','delivered','failed','ringing',
                    'answered','no_answer','busy','accepted','rejected','timeout'
                  )),
  provider        TEXT,
  provider_ref    TEXT,
  error_message   TEXT,
  sent_at         TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_attempts_dispatch
  ON booking_dispatch_attempts(dispatch_id, created_at);

-- ── Haversine distance helper (km) ─────────────────────────────────
CREATE OR REPLACE FUNCTION haversine_km(
  lat1 DOUBLE PRECISION, lng1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION, lng2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION AS $$
  SELECT 6371.0 * 2 * ASIN(SQRT(
    POWER(SIN(RADIANS(lat2 - lat1) / 2), 2) +
    COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
    POWER(SIN(RADIANS(lng2 - lng1) / 2), 2)
  ));
$$ LANGUAGE SQL IMMUTABLE;

-- ── Find nearest active vendors for a service ──────────────────────
CREATE OR REPLACE FUNCTION find_nearest_vendors(
  p_service_id TEXT,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_limit INT DEFAULT 3,
  p_max_km DOUBLE PRECISION DEFAULT 100
) RETURNS TABLE (
  vendor_id UUID,
  business_name TEXT,
  phone TEXT,
  distance_km DOUBLE PRECISION
) AS $$
  SELECT
    vp.id,
    vp.business_name,
    vp.phone,
    haversine_km(p_lat, p_lng, vp.address_lat, vp.address_lng) AS distance_km
  FROM vendor_partners vp
  JOIN vendor_partner_services vps ON vps.vendor_id = vp.id
  WHERE vp.status = 'active'
    AND vps.is_active = TRUE
    AND (vps.service_id = p_service_id OR vps.category_id = p_service_id)
    AND vp.address_lat IS NOT NULL
    AND vp.address_lng IS NOT NULL
    AND haversine_km(p_lat, p_lng, vp.address_lat, vp.address_lng) <= p_max_km
  ORDER BY distance_km ASC
  LIMIT p_limit;
$$ LANGUAGE SQL STABLE;

-- ── updated_at triggers ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vendor_partners_updated ON vendor_partners;
CREATE TRIGGER trg_vendor_partners_updated
  BEFORE UPDATE ON vendor_partners FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_booking_dispatch_updated ON booking_dispatch;
CREATE TRIGGER trg_booking_dispatch_updated
  BEFORE UPDATE ON booking_dispatch FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- RLS: service role only for sensitive tables (edge functions use service key)
ALTER TABLE vendor_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_partner_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_otp ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_dispatch ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_dispatch_attempts ENABLE ROW LEVEL SECURITY;
