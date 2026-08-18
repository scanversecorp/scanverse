# ScanV — Secrets & PINs Inventory

**Updated:** 12 Aug 2026

> **Git-safe version:** Secret **names** and storage locations only. Values are set in Supabase Dashboard → Project Settings → Edge Functions → Secrets, or via `npx supabase secrets set`.

---

## PIN Secrets (Supabase Edge Function Secrets)

| Secret Name | Where Set | Purpose | Notes |
|-------------|-----------|---------|-------|
| `ADMIN_HUB_PIN` | Supabase secrets | Admin Control Center (`#admin`) | Owner/leader access |
| `EXEC_DASHBOARD_PIN` | Supabase secrets | Executive Dashboard (`#exec`) | Exec metrics only; does not unlock `#admin` |
| `SUPPORT_ADMIN_PIN` | Supabase secrets | Support admin + hub + exec dashboard | Full update access |
| `SUPPORT_AGENT_PIN` | Supabase secrets | Customer support desk (`#customer-support`) | Read-only customer search + ticket desk |
| `PRICING_ADMIN_PIN` | Supabase secrets | Pricing admin (`#pricing-admin`) | Also grants hub access |
| `VENDOR_ADMIN_PIN` | Supabase secrets | Vendor admin (`#vendor-admin`) | Also grants hub access |

**Setup convention (per project docs):** Owner/admin PINs and agent PINs are configured separately in Supabase — see [ADMIN-HUB.md](./ADMIN-HUB.md). Do not commit values to git.

---

## Payment Secrets

| Secret Name | Where Set | Purpose | Notes |
|-------------|-----------|---------|-------|
| `RAZORPAY_KEY_ID` | Supabase secrets | Razorpay API key ID | Live/test per Razorpay dashboard |
| `RAZORPAY_KEY_SECRET` | Supabase secrets | Razorpay API secret | Required for payment links |
| `RAZORPAY_WEBHOOK_SECRET` | Supabase secrets | Webhook HMAC verification | From Razorpay webhook config |
| `APP_URL` | Supabase secrets | Payment redirect URL | `https://getscanv.com` |

---

## OTP & Messaging Secrets

| Secret Name | Where Set | Purpose | Notes |
|-------------|-----------|---------|-------|
| `TWOFACTOR_API_KEY` | Supabase secrets | 2Factor.in SMS OTP | Server-side only (removed from client) |
| `MSG91_AUTH_KEY` | Supabase secrets | MSG91 SMS | Primary SMS provider |
| `MSG91_SMS_SENDER` | Supabase secrets | SMS sender ID | Default: `SCANV` |
| `MSG91_SMS_TEMPLATE_ID` | Supabase secrets | DLT template | Optional |
| `MSG91_WHATSAPP_AUTH_KEY` | Supabase secrets | MSG91 WhatsApp | |
| `MSG91_WHATSAPP_INTEGRATED_NUMBER` | Supabase secrets | WhatsApp business number | |
| `MSG91_WHATSAPP_TEMPLATE_NAME` | Supabase secrets | WhatsApp template | |
| `MSG91_WHATSAPP_TEMPLATE_NAMESPACE` | Supabase secrets | Template namespace | |
| `MSG91_WHATSAPP_TEMPLATE_LANG` | Supabase secrets | Template language | Default: `en` |
| `MSG91_WHATSAPP_TEMPLATE_BODY2` | Supabase secrets | Two-body template flag | |
| `TWILIO_ACCOUNT_SID` | Supabase secrets | Twilio fallback | SMS/Voice/WhatsApp |
| `TWILIO_AUTH_TOKEN` | Supabase secrets | Twilio auth | |
| `TWILIO_SMS_FROM` | Supabase secrets | SMS from number | |
| `TWILIO_VOICE_FROM` | Supabase secrets | Voice from number | |
| `TWILIO_WHATSAPP_FROM` | Supabase secrets | WhatsApp from | |
| `TWILIO_PHONE_NUMBER` | Supabase secrets | Fallback phone | |
| `WHATSAPP_WEBHOOK_SECRET` | Supabase secrets | Inbound WA webhook auth | |
| `WHATSAPP_WEBHOOK_HEADER` | Supabase secrets | Custom header name | Default: `x-webhook-secret` |
| `OTP_DEV_MODE` | Supabase secrets | Dev OTP bypass | Set `1` for dev only |

---

## Dispatch & Vendor Secrets

| Secret Name | Where Set | Purpose | Notes |
|-------------|-----------|---------|-------|
| `DISPATCH_SECRET` | Supabase secrets | Booking dispatch auth | Protect tick/cron endpoints |
| `DIGIO_API_KEY` | Supabase secrets | Digio eKYC | Vendor onboarding |
| `DIGIO_CLIENT_ID` | Supabase secrets | Digio client ID | |
| `DIGIO_CLIENT_SECRET` | Supabase secrets | Digio client secret | |
| `EKYC_STRICT` | Supabase secrets | Strict eKYC mode | Set `1` to enforce |
| `PAN_VERIFY_API_KEY` | Supabase secrets | PAN verification | Vendor onboard |

---

## Email & Support Secrets

| Secret Name | Where Set | Purpose | Notes |
|-------------|-----------|---------|-------|
| `RESEND_API_KEY` | Supabase secrets | Ticket closure + health report emails | Required for outbound @getscanv.com |
| `SUPPORT_EMAIL_FROM` | Supabase secrets | From address | Prefer `support@getscanv.com` (see `docs/GETSCANV-EMAIL.md`) |
| `HEALTH_REPORT_FROM` | Supabase secrets | Health report sender | Default: same as `SUPPORT_EMAIL_FROM` |
| `HEALTH_REPORT_TO` | Supabase secrets | Health report recipients | Default: `sam@getscanv.com,jas@getscanv.com` |
| `HEALTH_REPORT_SECRET` | Supabase secrets + Vault | Cron auth for health-report edge fn | See `scripts/setup-health-report-cron.sql` |

---

## Supabase Platform Keys

| Key | Where Set | Purpose | Notes |
|-----|-----------|---------|-------|
| `SUPABASE_URL` | Auto (edge runtime) | Project URL | `https://rwlwrmmqtedugcreweut.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto (edge runtime) | Server-side DB access | Never expose to client |
| Anon/Publishable key | `src/App.js` (client) | Public SPA access | Protected by RLS |

---

## Local Environment (`.env` — NOT in git)

| Variable | Purpose | Notes |
|----------|---------|-------|
| Local dev overrides | Development | Listed in `.gitignore`; untracked as of 12 Aug 2026 audit |

---

## Session Storage Keys (Client — not secrets)

| Key | Purpose |
|-----|---------|
| `scanv_admin_auth` | Admin hub session (24h) |
| `scanv_pricing_auth` | Pricing admin session |
| `scanv_support_auth` | Support desk session |
| `scanv_vendor_auth` | Vendor admin session |
| `scanv_terms_accepted` | Terms acceptance timestamp |
| `scanv_uid` | Cached user ID |

---

## Removed from Client (Security Fix 12 Aug 2026)

| Item | Status |
|------|--------|
| `TWOFACTOR_KEY` in App.js | **Removed** — was unused; OTP via edge function |
| `FAST2SMS_KEY` in App.js | **Removed** — was unused |

**Action:** Rotate the 2Factor API key in 2Factor dashboard if it was ever active, since it was previously in client bundle.

---

## How to Set Secrets

```bash
# From project root, linked to rwlwrmmqtedugcreweut
npx supabase secrets set \
  ADMIN_HUB_PIN=<value> \
  SUPPORT_ADMIN_PIN=<value> \
  SUPPORT_AGENT_PIN=<value> \
  PRICING_ADMIN_PIN=<value> \
  VENDOR_ADMIN_PIN=<value> \
  RAZORPAY_KEY_ID=<value> \
  RAZORPAY_KEY_SECRET=<value> \
  RAZORPAY_WEBHOOK_SECRET=<value> \
  TWOFACTOR_API_KEY=<value> \
  APP_URL=https://getscanv.com

npx supabase functions deploy --no-verify-jwt
```

---

*For owner-local values reference, see `LOCAL-OWNER-INVENTORY.md` in backup package only (not committed to git).*
