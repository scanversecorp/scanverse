-- ScanV: 2Factor.in SMS OTP delivery report webhook storage

CREATE TABLE IF NOT EXISTS otp_delivery_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      TEXT NOT NULL DEFAULT '2factor',
  session_id    TEXT,
  mobile        TEXT,
  status        TEXT NOT NULL DEFAULT 'unknown'
                CHECK (status IN ('delivered', 'failed', 'pending', 'unknown')),
  raw_status    TEXT,
  raw_payload   JSONB NOT NULL DEFAULT '{}'::jsonb,
  otp_context   TEXT,
  vendor_otp_id UUID REFERENCES vendor_otp(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_delivery_reports_created
  ON otp_delivery_reports(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_otp_delivery_reports_session
  ON otp_delivery_reports(session_id)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_otp_delivery_reports_mobile
  ON otp_delivery_reports(mobile, created_at DESC)
  WHERE mobile IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_otp_delivery_reports_status
  ON otp_delivery_reports(status, created_at DESC);

-- Link send-otp rows to 2Factor SessionId for correlation
ALTER TABLE vendor_otp
  ADD COLUMN IF NOT EXISTS session_id TEXT;

CREATE INDEX IF NOT EXISTS idx_vendor_otp_session
  ON vendor_otp(session_id)
  WHERE session_id IS NOT NULL;

ALTER TABLE otp_delivery_reports ENABLE ROW LEVEL SECURITY;
