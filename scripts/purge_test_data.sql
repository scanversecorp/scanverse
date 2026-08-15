-- Pre-launch purge: test customers, partners, bookings, @scanv.app auth users.
-- Preserves: admin profiles, service_pricing, social content, vendor leads catalog, IAM, platform settings.
-- Run: npx supabase db execute --file scripts/purge_test_data.sql --linked

BEGIN;

DELETE FROM booking_dispatch_attempts;
DELETE FROM booking_dispatch;
DELETE FROM vendor_live_locations;
DELETE FROM vendor_gps_history;
DELETE FROM external_logistics_trips;
DELETE FROM booking_cancellations;
DELETE FROM payments;
DELETE FROM payment_intents;
DELETE FROM bookings;
DELETE FROM service_requests;
DELETE FROM training_requests;
DELETE FROM support_tickets;
DELETE FROM investment_requests;
DELETE FROM user_locations;
DELETE FROM vendor_partner_services;
DELETE FROM vendor_ekyc_sessions;
UPDATE vendor_lead_tracking SET vendor_partner_id = NULL WHERE vendor_partner_id IS NOT NULL;
DELETE FROM vendor_partners;
DELETE FROM vendor_otp;
DELETE FROM wa_verifications;
DELETE FROM qr_scans;
DELETE FROM visitor_sessions;
DELETE FROM gps_daily_status;

DELETE FROM public.profiles
WHERE role IN ('customer', 'partner', 'candidate')
   OR (role IS DISTINCT FROM 'admin' AND (id LIKE 'cust_%' OR id LIKE 'part_%'));

DELETE FROM auth.users
WHERE lower(email) LIKE '%@scanv.app';

COMMIT;
