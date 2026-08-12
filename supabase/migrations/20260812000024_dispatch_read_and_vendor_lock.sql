-- Allow customers/partners to read dispatch GPS for map fallback; document vendor busy-lock rule

CREATE POLICY booking_dispatch_customer_select ON booking_dispatch
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id::text = booking_dispatch.booking_id::text
        AND b.customer_id::text = auth.uid()::text
    )
  );

CREATE POLICY booking_dispatch_partner_select ON booking_dispatch
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id::text = booking_dispatch.booking_id::text
        AND b.partner_id::text = auth.uid()::text
    )
  );

GRANT SELECT ON booking_dispatch TO authenticated;

-- Backfill customer GPS on bookings from dispatch rows (map fallback before migration 24 RLS)
UPDATE bookings b
SET customer_lat = d.customer_lat,
    customer_lng = d.customer_lng
FROM booking_dispatch d
WHERE b.id = d.booking_id
  AND b.customer_lat IS NULL
  AND b.customer_lng IS NULL
  AND d.customer_lat IS NOT NULL
  AND d.customer_lng IS NOT NULL;
