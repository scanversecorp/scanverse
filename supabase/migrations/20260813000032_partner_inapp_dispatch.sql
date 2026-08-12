-- ScanV: in-app partner job offers (Uber-style accept/reject in the app)

-- Allow 'app' channel on dispatch attempts
ALTER TABLE booking_dispatch_attempts DROP CONSTRAINT IF EXISTS booking_dispatch_attempts_channel_check;
ALTER TABLE booking_dispatch_attempts ADD CONSTRAINT booking_dispatch_attempts_channel_check
  CHECK (channel IN ('sms','call','whatsapp_text','whatsapp_call','app'));

-- Partners can read their own dispatch attempts (pending in-app offers)
DROP POLICY IF EXISTS dispatch_attempts_partner_select ON booking_dispatch_attempts;
CREATE POLICY dispatch_attempts_partner_select ON booking_dispatch_attempts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vendor_partners vp
      WHERE vp.id = booking_dispatch_attempts.vendor_id
        AND public.auth_matches_profile(vp.profile_id::text)
    )
  );

-- Partners can read dispatch rows while they have an active in-app offer
DROP POLICY IF EXISTS booking_dispatch_partner_offer_select ON booking_dispatch;
CREATE POLICY booking_dispatch_partner_offer_select ON booking_dispatch
  FOR SELECT
  TO authenticated
  USING (
    status IN ('pending', 'dispatching')
    AND EXISTS (
      SELECT 1 FROM booking_dispatch_attempts a
      JOIN vendor_partners vp ON vp.id = a.vendor_id
      WHERE a.dispatch_id = booking_dispatch.id
        AND a.channel = 'app'
        AND a.status = 'offered'
        AND public.auth_matches_profile(vp.profile_id::text)
    )
  );

GRANT SELECT ON booking_dispatch_attempts TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE booking_dispatch_attempts;
    ALTER PUBLICATION supabase_realtime ADD TABLE booking_dispatch;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
