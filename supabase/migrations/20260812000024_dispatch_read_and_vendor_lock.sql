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
