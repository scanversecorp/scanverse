-- Vendor partner profile expansion: names, mobile2, vehicle, license, photo, education, app/GPS confirmations
-- GPS history table + private vendor-photos storage bucket

ALTER TABLE vendor_partners
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS mobile2 TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_type TEXT
    CHECK (vehicle_type IS NULL OR vehicle_type IN ('2W', '4W')),
  ADD COLUMN IF NOT EXISTS license_number TEXT,
  ADD COLUMN IF NOT EXISTS photo_path TEXT,
  ADD COLUMN IF NOT EXISTS highest_education TEXT,
  ADD COLUMN IF NOT EXISTS app_installed_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS gps_allowed_confirmed BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_vendor_partners_name
  ON vendor_partners(first_name, last_name)
  WHERE first_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vendor_partners_mobile2
  ON vendor_partners(mobile2)
  WHERE mobile2 IS NOT NULL;

-- Backfill first/last from contact_name where missing
UPDATE vendor_partners
SET
  first_name = COALESCE(first_name, NULLIF(split_part(trim(contact_name), ' ', 1), '')),
  last_name = COALESCE(
    last_name,
    NULLIF(trim(substring(trim(contact_name) FROM position(' ' IN trim(contact_name)) + 1)), '')
  )
WHERE contact_name IS NOT NULL
  AND (first_name IS NULL OR last_name IS NULL);

-- ── GPS location history (populated on update-location) ─────────────
CREATE TABLE IF NOT EXISTS vendor_gps_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id    UUID NOT NULL REFERENCES vendor_partners(id) ON DELETE CASCADE,
  lat          DOUBLE PRECISION NOT NULL,
  lng          DOUBLE PRECISION NOT NULL,
  accuracy_m   DOUBLE PRECISION,
  source       TEXT NOT NULL DEFAULT 'app',
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_gps_history_vendor_time
  ON vendor_gps_history(vendor_id, recorded_at DESC);

ALTER TABLE vendor_gps_history ENABLE ROW LEVEL SECURITY;

-- ── Private storage bucket for partner photos (access via edge function signed URLs only) ──
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vendor-photos',
  'vendor-photos',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- No storage policies for vendor-photos: bucket is private; edge functions use service role signed URLs.
