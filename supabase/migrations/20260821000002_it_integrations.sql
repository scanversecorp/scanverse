-- IT vendor / API integration registry for Admin → IT Integrations tab.

CREATE TABLE IF NOT EXISTS public.it_integrations (
  id                  TEXT PRIMARY KEY,
  vendor_name         TEXT NOT NULL,
  contact_phone       TEXT,
  portal_url          TEXT,
  api_url             TEXT,
  credential_key      TEXT,
  credential_purpose  TEXT NOT NULL DEFAULT '',
  scanv_usage         TEXT NOT NULL DEFAULT '',
  switch_key          TEXT,
  switch_state        TEXT NOT NULL DEFAULT 'on'
    CHECK (switch_state IN ('on', 'off', 'hold')),
  hold_until          TIMESTAMPTZ,
  sort_order          INT NOT NULL DEFAULT 0,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by          TEXT
);

CREATE INDEX IF NOT EXISTS idx_it_integrations_sort
  ON public.it_integrations(sort_order, vendor_name);

ALTER TABLE public.it_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY it_integrations_admin ON public.it_integrations
  FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

COMMENT ON TABLE public.it_integrations IS
  'Third-party IT vendors — contact, URLs, credential purpose, ON/OFF/HOLD-UNTIL switches.';

INSERT INTO public.it_integrations (
  id, vendor_name, contact_phone, portal_url, api_url,
  credential_key, credential_purpose, scanv_usage, switch_key, switch_state, sort_order
) VALUES
  ('2factor', '2Factor.in', '+91-806-954-8717', 'https://2factor.in/CP/Dashboard_list.php', 'https://2factor.in/API/V1/{API_KEY}/SMS/{PHONE}/{OTP}/ScanV',
   'TWOFACTOR_API_KEY', 'API key in URL path — primary India SMS OTP + voice fallback', 'send-otp · vendor-onboard OTP · delivery callbacks', 'vendor_enable_2factor', 'on', 10),
  ('msg91', 'MSG91', '+91-9650-588-588', 'https://control.msg91.com', 'https://api.msg91.com/api/v5',
   'MSG91_AUTH_KEY', 'Auth key header — SMS + WhatsApp OTP fallback after 2Factor', 'send-otp · whatsapp-verify', 'vendor_enable_msg91', 'on', 20),
  ('fast2sms', 'Fast2SMS', '+91-955-511-5533', 'https://www.fast2sms.com/dashboard', 'https://www.fast2sms.com/dev/bulkV2',
   'FAST2SMS_API_KEY', 'Authorization bearer — DLT SMS after MSG91 fails', 'send-otp · dispatch SMS', 'vendor_enable_fast2sms', 'on', 30),
  ('twilio', 'Twilio', '', 'https://console.twilio.com', 'https://api.twilio.com',
   'TWILIO_ACCOUNT_SID', 'Account SID + TWILIO_AUTH_TOKEN — international SMS/voice last resort', 'send-otp voice/SMS · dispatch', 'vendor_enable_twilio', 'on', 40),
  ('whatsapp', 'MSG91 WhatsApp', '+91-9270194842', 'https://control.msg91.com/app/m/l/whatsapp', 'https://api.msg91.com/api/v5/whatsapp',
   'MSG91_WHATSAPP_INTEGRATED_NUMBER', 'Integrated number 919270194842 — WhatsApp OTP backup channel', 'whatsapp-verify · booking OTP', 'vendor_enable_whatsapp', 'on', 50),
  ('razorpay', 'Razorpay', '+91-120-445-5666', 'https://dashboard.razorpay.com', 'https://api.razorpay.com/v1',
   'RAZORPAY_KEY_ID', 'Key ID + RAZORPAY_KEY_SECRET — payment links, webhooks, Route transfers', 'razorpay-payment · vendor payouts', 'vendor_enable_razorpay', 'on', 60),
  ('vyapar', 'HDFC Vyapar UPI', '', 'https://vyaparapp.in', '',
   'VYAPAR_WEBHOOK_SECRET', 'Webhook HMAC — UPI collect notify on razorpay-payment function', 'Static/dynamic UPI QR · vyapar.172928067841@hdfcbank', 'vendor_enable_vyapar_upi', 'off', 70),
  ('upi_gpay', 'Google Pay UPI', '', 'https://pay.google.com', 'upi://pay',
   '', 'Deep link only — no API key', 'Android intent / gpay:// on iOS payment button', 'vendor_enable_upi_gpay', 'off', 80),
  ('upi_phonepe', 'PhonePe UPI', '', 'https://www.phonepe.com/business-solutions', 'phonepe://pay',
   '', 'Deep link only — no API key', 'PhonePe UPI button on checkout', 'vendor_enable_upi_phonepe', 'off', 90),
  ('upi_paytm', 'Paytm UPI', '', 'https://business.paytm.com', 'paytmmp://pay',
   '', 'Deep link only — no API key', 'Paytm UPI button on checkout', 'vendor_enable_upi_paytm', 'off', 100),
  ('upi_navi', 'Navi UPI', '', 'https://navi.com', 'upi://pay',
   '', 'Deep link only — no API key', 'Navi UPI payment button', 'vendor_enable_upi_navi', 'off', 110),
  ('upi_bhim', 'BHIM UPI', '', 'https://www.bhimupi.org.in', 'upi://pay',
   '', 'Deep link only — no API key', 'BHIM UPI payment button', 'vendor_enable_upi_bhim', 'off', 120),
  ('upi_any', 'Any UPI app', '', '', 'upi://pay',
   '', 'Generic UPI deep link', 'Pay via UPI fallback button', 'vendor_enable_upi_any', 'off', 130),
  ('digio', 'Digio', '+91-888-070-0700', 'https://www.digio.in', 'https://api.digio.in',
   'DIGIO_CLIENT_ID', 'Client ID + DIGIO_CLIENT_SECRET — vendor Aadhaar eKYC', 'vendor-onboard ekyc-aadhaar', NULL, 'on', 140),
  ('resend', 'Resend', '', 'https://resend.com/emails', 'https://api.resend.com',
   'RESEND_API_KEY', 'Bearer token — transactional email', 'support-tickets · booking confirmation · health reports', NULL, 'on', 150),
  ('cloudflare_email', 'Cloudflare Email', '', 'https://dash.cloudflare.com', 'https://api.cloudflare.com/client/v4',
   'CLOUDFLARE_API_TOKEN', 'API token — email routing / sending fallback', 'notify.ts email when Resend unavailable', NULL, 'on', 160),
  ('supabase', 'Supabase', '', 'https://supabase.com/dashboard/project/rwlwrmmqtedugcreweut', 'https://rwlwrmmqtedugcreweut.supabase.co',
   'SUPABASE_SERVICE_ROLE_KEY', 'Service role — edge functions, admin hub, cron', 'Database · auth · storage · edge functions', NULL, 'on', 170),
  ('vercel', 'Vercel', '', 'https://vercel.com/dashboard', '',
   '', 'Git deploy — no runtime API key in edge functions', 'getscanv.com hosting · auto deploy on push', NULL, 'on', 180)
ON CONFLICT (id) DO NOTHING;
