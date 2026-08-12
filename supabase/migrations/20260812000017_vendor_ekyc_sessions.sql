-- ScanV: Aadhaar eKYC verification sessions (UI step → register linkage)

CREATE TABLE IF NOT EXISTS vendor_ekyc_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ekyc_ref      TEXT NOT NULL UNIQUE,
  aadhaar_hash  TEXT NOT NULL,
  last4         TEXT NOT NULL,
  verified      BOOLEAN NOT NULL DEFAULT FALSE,
  provider      TEXT,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_ekyc_lookup
  ON vendor_ekyc_sessions(aadhaar_hash, verified, expires_at DESC);

ALTER TABLE vendor_ekyc_sessions ENABLE ROW LEVEL SECURITY;
