-- Allow customers to read live partner GPS for their bookings; partners to publish location

CREATE POLICY vendor_live_customer_select ON vendor_live_locations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id::text = vendor_live_locations.booking_id::text
        AND b.customer_id::text = auth.uid()::text
    )
  );

CREATE POLICY vendor_live_partner_upsert ON vendor_live_locations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id::text = vendor_live_locations.booking_id::text
        AND b.partner_id::text = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id::text = vendor_live_locations.booking_id::text
        AND b.partner_id::text = auth.uid()::text
    )
  );

-- Realtime needs SELECT for subscribed rows
GRANT SELECT ON vendor_live_locations TO authenticated;
