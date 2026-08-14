-- Razorpay Route: vendor linked accounts + payment split / transfer tracking

ALTER TABLE vendor_partners
  ADD COLUMN IF NOT EXISTS razorpay_linked_account_id TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_route_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (razorpay_route_status IN ('pending', 'activated', 'suspended'));

CREATE INDEX IF NOT EXISTS idx_vendor_partners_razorpay_account
  ON vendor_partners(razorpay_linked_account_id)
  WHERE razorpay_linked_account_id IS NOT NULL;

ALTER TABLE payment_intents
  ADD COLUMN IF NOT EXISTS service_price_paise INTEGER,
  ADD COLUMN IF NOT EXISTS platform_share_paise INTEGER,
  ADD COLUMN IF NOT EXISTS vendor_share_paise INTEGER,
  ADD COLUMN IF NOT EXISTS route_vendor_id UUID REFERENCES vendor_partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS razorpay_transfer_id TEXT,
  ADD COLUMN IF NOT EXISTS transfer_status TEXT
    CHECK (transfer_status IS NULL OR transfer_status IN (
      'pending', 'created', 'processed', 'failed', 'reversed', 'skipped'
    ));

CREATE INDEX IF NOT EXISTS idx_payment_intents_transfer
  ON payment_intents(transfer_status, route_vendor_id)
  WHERE transfer_status IS NOT NULL;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS route_vendor_id UUID REFERENCES vendor_partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS razorpay_transfer_id TEXT,
  ADD COLUMN IF NOT EXISTS transfer_status TEXT;

COMMENT ON COLUMN vendor_partners.razorpay_linked_account_id IS 'Razorpay Route Linked Account acc_* from dashboard';
COMMENT ON COLUMN payment_intents.vendor_share_paise IS '85% of service_price_paise — transferred on dispatch assign (Razorpay only)';
