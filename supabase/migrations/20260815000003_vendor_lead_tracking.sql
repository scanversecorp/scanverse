-- Admin vendor lead onboarding state (research catalog stays in edge JSON; tracking in DB)

CREATE TABLE IF NOT EXISTS vendor_lead_tracking (
  lead_id             TEXT PRIMARY KEY,
  onboard_status      TEXT NOT NULL DEFAULT 'research'
                      CHECK (onboard_status IN (
                        'research', 'contacted', 'validating', 'ready', 'added', 'rejected'
                      )),
  phone_verified      BOOLEAN NOT NULL DEFAULT FALSE,
  name_verified       BOOLEAN NOT NULL DEFAULT FALSE,
  address_verified    BOOLEAN NOT NULL DEFAULT FALSE,
  aadhaar_verified    BOOLEAN NOT NULL DEFAULT FALSE,
  aadhaar_last4       TEXT,
  validation_notes    TEXT,
  vendor_partner_id   UUID REFERENCES vendor_partners(id) ON DELETE SET NULL,
  updated_by          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_lead_tracking_status
  ON vendor_lead_tracking(onboard_status);

CREATE INDEX IF NOT EXISTS idx_vendor_lead_tracking_partner
  ON vendor_lead_tracking(vendor_partner_id)
  WHERE vendor_partner_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_vendor_lead_tracking_updated ON vendor_lead_tracking;
CREATE TRIGGER trg_vendor_lead_tracking_updated
  BEFORE UPDATE ON vendor_lead_tracking
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

ALTER TABLE vendor_lead_tracking ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE vendor_lead_tracking IS
  'PIN-gated admin onboarding checklist for vendor research leads (JSON catalog + DB state).';
