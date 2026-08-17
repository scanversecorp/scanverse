# ScanV Vendor & Booking Dispatch Deploy

## Overview

When a customer confirms a paid booking, `booking-dispatch` automatically:

1. Finds the **3 nearest active partners** for that service (GPS + database)
2. Notifies partner #1 via **SMS → outbound call → WhatsApp text/call** (if call fails)
3. Waits **2 minutes**, retries (attempt 2)
4. If no accept → partner #2, then #3
5. Partner accepts by replying `ACCEPT BK-XXXX` or pressing **1** on the call

## URLs

| Page | URL |
|------|-----|
| Partner onboarding | `https://getscanv.com/#vendor-onboard` |
| Partner admin (activate/offboard) | `https://getscanv.com/#vendor-admin` |

## Deploy

```bash
cd /path/to/scanverse

# 1. Apply migration
npx supabase db push

# 2. Set secrets
npx supabase secrets set \
  VENDOR_ADMIN_PIN=YourAdminPin \
  DISPATCH_SECRET=YourDispatchSecret \
  MSG91_AUTH_KEY=your_key \
  TWILIO_ACCOUNT_SID=your_sid \
  TWILIO_AUTH_TOKEN=your_token \
  TWILIO_PHONE_NUMBER=+91XXXXXXXXXX \
  TWILIO_SMS_FROM=+91XXXXXXXXXX \
  TWILIO_VOICE_FROM=+91XXXXXXXXXX \
  TWILIO_WHATSAPP_FROM=whatsapp:+91XXXXXXXXXX \
  MSG91_WHATSAPP_INTEGRATED_NUMBER=91XXXXXXXXXX \
  DIGIO_API_KEY=optional_for_ekyc \
  EKYC_STRICT=1

# 3. Deploy edge functions
npx supabase functions deploy send-otp --no-verify-jwt
npx supabase functions deploy vendor-onboard --no-verify-jwt
npx supabase functions deploy booking-dispatch --no-verify-jwt
```

## Cron for retry ticks (every 1 min)

Migration `20260812000008_dispatch_cron.sql` schedules `scanv-dispatch-tick` via **pg_cron** — runs every minute and processes due dispatches (2-minute retry gaps).

### Setup (one time, after `db push`)

1. Apply migration:
   ```bash
   npx supabase db push
   npx supabase functions deploy booking-dispatch --no-verify-jwt
   ```

2. Store your dispatch secret in Vault — **Supabase Dashboard → SQL Editor**, run (use your real `DISPATCH_SECRET`):
   ```sql
   SELECT vault.create_secret(
     'ScanV2026',
     'scanv_dispatch_secret',
     'ScanV booking-dispatch cron auth'
   );
   ```

3. Test manually:
   ```sql
   SELECT public.scanv_dispatch_tick_cron();
   ```

4. Confirm job is scheduled:
   ```sql
   SELECT jobid, jobname, schedule FROM cron.job WHERE jobname = 'scanv-dispatch-tick';
   ```

See also: `scripts/setup-dispatch-cron.sql`

### Manual curl (debug)

```bash
curl -X POST 'https://rwlwrmmqtedugcreweut.supabase.co/functions/v1/booking-dispatch' \
  -H 'Content-Type: application/json' \
  -H 'x-dispatch-secret: ScanV2026' \
  -d '{"action":"tick"}'
```

## Twilio webhooks

- SMS inbound: `.../booking-dispatch?action=inbound-sms`
- Call status: `.../booking-dispatch?action=call-status`

## Partner onboarding fields

| Field | Required | Validation |
|-------|----------|------------|
| Phone | Yes | OTP |
| Aadhaar | Yes | eKYC (Digio when configured) |
| PAN | No | Format + optional API |
| Address | Yes | Shop/Flat, Street, City, PIN, State |
| GPS | Yes | Real location; VPN blocked for non-India country |
| Services | Yes | Multi-select from catalog |
