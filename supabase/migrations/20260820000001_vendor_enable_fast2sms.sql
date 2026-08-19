-- Fast2SMS DLT SMS fallback (default ON; between MSG91 and Twilio)

INSERT INTO platform_settings (key, value, description)
VALUES ('vendor_enable_fast2sms', '1', 'Fast2SMS DLT SMS fallback')
ON CONFLICT (key) DO NOTHING;
