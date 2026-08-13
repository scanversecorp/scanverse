-- Manual go-live checklist items (tick in Admin Hub → Go-Live tab)

INSERT INTO platform_settings (key, value, description)
SELECT k, '0', d FROM (VALUES
  ('go_live_check_2factor_wallet', '2Factor wallet / credits topped up'),
  ('go_live_check_dlt_sender', 'DLT sender ID registered'),
  ('go_live_check_dlt_template', 'DLT OTP template approved'),
  ('go_live_check_2factor_callback_url', '2Factor callback URL configured'),
  ('go_live_check_otp_sms_test', 'OTP SMS test on real +91 mobile'),
  ('go_live_check_otp_delivery_report', 'OTP delivery report shows delivered'),
  ('go_live_check_vyapar_kyc', 'HDFC Vyapar KYC approved'),
  ('go_live_check_upi_vpa_live', 'UPI VPA live for collections'),
  ('go_live_check_vyapar_qr_standee', 'Standee QR matches app'),
  ('go_live_check_vyapar_webhook_url', 'Vyapar webhook URL configured'),
  ('go_live_check_upi_payment_test', 'UPI test payment auto-confirms'),
  ('go_live_check_vyapar_dashboard', 'Payment in Vyapar dashboard'),
  ('go_live_check_razorpay_live_mode', 'Razorpay Live mode enabled'),
  ('go_live_check_razorpay_webhook_events', 'Razorpay webhook events enabled'),
  ('go_live_check_razorpay_test_payment', 'Razorpay test payment completed'),
  ('go_live_check_2factor_key_rotated', '2Factor key rotated if exposed'),
  ('go_live_check_msg91_dlt', 'MSG91 DLT template (optional)'),
  ('go_live_check_whatsapp_template', 'WhatsApp template approved (optional)'),
  ('go_live_check_whatsapp_verify_deployed', 'whatsapp-verify deployed (optional)'),
  ('go_live_check_vercel_deployed', 'Vercel deploy verified'),
  ('go_live_check_qr_flow', 'QR opens browse without install prompt'),
  ('go_live_check_privacy_terms', 'Privacy and terms pages final'),
  ('go_live_check_mobile_devices', 'Tested on iPhone + Android'),
  ('go_live_check_vendors_live', 'Live vendors per category'),
  ('go_live_check_vendor_onboard_test', 'Vendor onboard flow tested'),
  ('go_live_check_dispatch_mode_set', 'Dispatch mode configured'),
  ('go_live_check_support_desk_test', 'Support desk tested'),
  ('go_live_check_support_phone_staffed', 'Support phone staffed'),
  ('go_live_check_e2e_browse', 'E2E: browse flow'),
  ('go_live_check_e2e_otp', 'E2E: OTP verify'),
  ('go_live_check_e2e_payment', 'E2E: payment'),
  ('go_live_check_e2e_track', 'E2E: track booking')
) AS t(k, d)
ON CONFLICT (key) DO NOTHING;
