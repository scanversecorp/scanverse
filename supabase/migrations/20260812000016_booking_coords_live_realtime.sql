-- Booking GPS coords for customer map + realtime on live partner locations

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS customer_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS customer_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS service_id TEXT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE vendor_live_locations;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
