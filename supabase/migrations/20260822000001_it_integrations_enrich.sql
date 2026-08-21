-- IT Integrations: full credential keys, new vendors (CDN, GitHub, Meta, PAN).

UPDATE public.it_integrations SET
  credential_key = 'TWOFACTOR_API_KEY',
  credential_purpose = 'API key in URL path — primary India SMS OTP + voice fallback'
WHERE id = '2factor';

UPDATE public.it_integrations SET
  credential_key = 'MSG91_AUTH_KEY',
  credential_purpose = 'Auth key header — SMS + WhatsApp OTP fallback after 2Factor'
WHERE id = 'msg91';

UPDATE public.it_integrations SET
  credential_key = 'FAST2SMS_API_KEY',
  credential_purpose = 'Authorization bearer — DLT SMS after MSG91 fails (optional: FAST2SMS_DLT_MESSAGE_ID)'
WHERE id = 'fast2sms';

UPDATE public.it_integrations SET
  credential_key = 'TWILIO_ACCOUNT_SID,TWILIO_AUTH_TOKEN',
  credential_purpose = 'Account SID + auth token — international SMS/voice last resort'
WHERE id = 'twilio';

UPDATE public.it_integrations SET
  credential_key = 'MSG91_AUTH_KEY,MSG91_WHATSAPP_INTEGRATED_NUMBER',
  credential_purpose = 'MSG91 auth + integrated WhatsApp number — OTP backup channel'
WHERE id = 'whatsapp';

UPDATE public.it_integrations SET
  credential_key = 'RAZORPAY_KEY_ID,RAZORPAY_KEY_SECRET',
  credential_purpose = 'Key ID + secret — payment links, webhooks, Route transfers (also RAZORPAY_WEBHOOK_SECRET)'
WHERE id = 'razorpay';

UPDATE public.it_integrations SET
  credential_key = 'VYAPAR_WEBHOOK_SECRET',
  credential_purpose = 'Webhook HMAC — UPI collect notify (merchant: vyapar.172928067841@hdfcbank)'
WHERE id = 'vyapar';

UPDATE public.it_integrations SET
  credential_key = 'DIGIO_CLIENT_ID,DIGIO_CLIENT_SECRET',
  credential_purpose = 'Client ID + secret — vendor Aadhaar eKYC (optional: DIGIO_API_KEY)'
WHERE id = 'digio';

UPDATE public.it_integrations SET
  credential_key = 'RESEND_API_KEY,SUPPORT_EMAIL_FROM',
  credential_purpose = 'Bearer token + from address — transactional email @getscanv.com'
WHERE id = 'resend';

UPDATE public.it_integrations SET
  credential_key = 'CLOUDFLARE_API_TOKEN,SUPPORT_EMAIL_FROM',
  credential_purpose = 'API token + from address — email sending fallback when Resend unavailable'
WHERE id = 'cloudflare_email';

INSERT INTO public.it_integrations (
  id, vendor_name, contact_phone, portal_url, api_url,
  credential_key, credential_purpose, scanv_usage, switch_key, switch_state, sort_order
) VALUES
  ('cloudflare_cdn', 'Cloudflare CDN & DNS', '', 'https://dash.cloudflare.com', 'https://api.cloudflare.com/client/v4',
   'CLOUDFLARE_API_TOKEN', 'API token — DNS, CDN cache, WAF, Email Routing (zone getscanv.com)',
   'getscanv.com edge · CF-Ray · cache · scripts/setup-getscanv-email-routing.mjs', NULL, 'on', 165),
  ('github', 'GitHub', '', 'https://github.com/scanversecorp/scanverse', 'https://api.github.com',
   '', 'Repo + Actions secrets — not Supabase edge (Vercel Git deploy, workflow PAT for Instagram cron)',
   'Source control · Vercel auto-deploy on push · .github/workflows/instagram-daily-post.yml', NULL, 'on', 185),
  ('meta_instagram', 'Meta Instagram', '', 'https://developers.facebook.com', 'https://graph.facebook.com',
   '', 'Vercel / GitHub Actions env — META_PAGE_ACCESS_TOKEN + META_IG_USER_ID (see docs/social/AUTOMATION.md)',
   'Daily @scanvapp posts · scripts/instagram_daily_post.mjs · api/cron/instagram-daily.js', NULL, 'on', 190),
  ('pan_verify', 'PAN Verification API', '', '', '',
   'PAN_VERIFY_API_KEY', 'Third-party PAN lookup — vendor onboarding document check',
   'vendor-onboard PAN verify step', NULL, 'on', 145)
ON CONFLICT (id) DO UPDATE SET
  vendor_name = EXCLUDED.vendor_name,
  portal_url = EXCLUDED.portal_url,
  api_url = EXCLUDED.api_url,
  credential_key = EXCLUDED.credential_key,
  credential_purpose = EXCLUDED.credential_purpose,
  scanv_usage = EXCLUDED.scanv_usage,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();
