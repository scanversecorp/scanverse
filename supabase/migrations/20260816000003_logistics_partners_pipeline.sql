-- Logistics partner outreach pipeline + external trip tracking (Porter, Borzo, etc.)

CREATE TABLE IF NOT EXISTS logistics_partner_pipeline (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  contact_email   TEXT NOT NULL,
  website         TEXT,
  api_status      TEXT NOT NULL DEFAULT 'none'
    CHECK (api_status IN ('none', 'contacted', 'in_discussion', 'sandbox', 'live', 'declined', 'paused')),
  outreach_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (outreach_status IN ('not_started', 'email_sent', 'follow_up_sent', 'replied', 'meeting', 'contract', 'integrated')),
  priority        INT NOT NULL DEFAULT 50,
  pune_coverage   BOOLEAN NOT NULL DEFAULT TRUE,
  sent_at         TIMESTAMPTZ,
  follow_up_at    TIMESTAMPTZ,
  last_reply_at   TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS external_logistics_trips (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id          TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  provider            TEXT NOT NULL CHECK (provider IN ('porter', 'borzo', 'shadowfax', 'qwqer', 'delhivery', 'scanv_partner')),
  external_order_id   TEXT,
  external_status     TEXT,
  quote_paise         INT,
  driver_name         TEXT,
  driver_phone        TEXT,
  vehicle_type        TEXT,
  last_lat            DOUBLE PRECISION,
  last_lng            DOUBLE PRECISION,
  tracking_url        TEXT,
  raw_payload         JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_external_trips_booking_provider
  ON external_logistics_trips (booking_id, provider);
CREATE INDEX IF NOT EXISTS idx_external_trips_provider_order
  ON external_logistics_trips (provider, external_order_id)
  WHERE external_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_logistics_pipeline_follow_up
  ON logistics_partner_pipeline (follow_up_at)
  WHERE follow_up_at IS NOT NULL;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS pickup_text TEXT,
  ADD COLUMN IF NOT EXISTS drop_text TEXT,
  ADD COLUMN IF NOT EXISTS pickup_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS pickup_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS drop_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS drop_lng DOUBLE PRECISION;

DROP TRIGGER IF EXISTS trg_logistics_partner_pipeline_updated ON logistics_partner_pipeline;
CREATE TRIGGER trg_logistics_partner_pipeline_updated
  BEFORE UPDATE ON logistics_partner_pipeline
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_external_logistics_trips_updated ON external_logistics_trips;
CREATE TRIGGER trg_external_logistics_trips_updated
  BEFORE UPDATE ON external_logistics_trips
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

ALTER TABLE logistics_partner_pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_logistics_trips ENABLE ROW LEVEL SECURITY;

INSERT INTO logistics_partner_pipeline (id, name, contact_email, website, api_status, outreach_status, priority, sent_at, follow_up_at, notes) VALUES
  ('porter', 'Porter Enterprise', 'help@porter.in', 'https://porter.in/api-integrations', 'contacted', 'email_sent', 10, NOW(), NOW() + INTERVAL '5 days', 'Initial API + Pune pilot email sent from connect@dcoreglobal.com'),
  ('borzo', 'Borzo', 'sales.in@borzodelivery.com', 'https://borzodelivery.com/in/business-api/doc', 'contacted', 'email_sent', 20, NOW(), NOW() + INTERVAL '5 days', 'Business API 1.8 — public docs available'),
  ('shadowfax', 'Shadowfax', 'hello@shadowfax.in', 'https://www.shadowfax.in/client-partner', 'contacted', 'email_sent', 30, NOW(), NOW() + INTERVAL '5 days', 'Hyperlocal API inquiry'),
  ('qwqer', 'QWQER Express', 'info@qwqer.in', 'https://qwqer.in/business/', 'contacted', 'email_sent', 40, NOW(), NOW() + INTERVAL '5 days', 'Express API inquiry'),
  ('delhivery', 'Delhivery', 'vendordesk@delhivery.com', 'https://www.delhivery.com/', 'contacted', 'email_sent', 50, NOW(), NOW() + INTERVAL '5 days', 'Hyperlocal + express API inquiry')
ON CONFLICT (id) DO UPDATE SET
  outreach_status = EXCLUDED.outreach_status,
  sent_at = COALESCE(logistics_partner_pipeline.sent_at, EXCLUDED.sent_at),
  follow_up_at = EXCLUDED.follow_up_at,
  notes = EXCLUDED.notes,
  updated_at = NOW();
