-- Dependent vendor / payment provider on-off switches (default ON)

INSERT INTO platform_settings (key, value, description)
SELECT k, '1', d FROM (VALUES
  ('vendor_enable_2factor', '2Factor.in SMS OTP'),
  ('vendor_enable_msg91', 'MSG91 SMS / WhatsApp fallback'),
  ('vendor_enable_twilio', 'Twilio SMS / voice fallback'),
  ('vendor_enable_whatsapp', 'WhatsApp OTP backup channel'),
  ('vendor_enable_razorpay', 'Razorpay payment links'),
  ('vendor_enable_vyapar_upi', 'HDFC Vyapar UPI QR + collect'),
  ('vendor_enable_upi_gpay', 'Google Pay UPI button'),
  ('vendor_enable_upi_phonepe', 'PhonePe UPI button'),
  ('vendor_enable_upi_paytm', 'Paytm UPI button'),
  ('vendor_enable_upi_navi', 'Navi UPI button'),
  ('vendor_enable_upi_bhim', 'BHIM UPI button'),
  ('vendor_enable_upi_any', 'Generic Pay via UPI button')
) AS t(k, d)
ON CONFLICT (key) DO NOTHING;
