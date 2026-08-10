# Deploy WhatsApp Verify (outbound backup for SMS OTP)

ScanV uses **SMS as primary** OTP delivery. When SMS fails or the user chooses WhatsApp, the PWA calls the `whatsapp-verify` edge function to send an **outbound WhatsApp message** and poll until the user replies.

**Supabase project:** `rwlwrmmqtedugcreweut`  
**WhatsApp Business number:** `+91-9270194842` → integrated number `919270194842`  
**Function URL:** `https://rwlwrmmqtedugcreweut.supabase.co/functions/v1/whatsapp-verify`

---

## What is already in the repo (no deploy needed for PWA)

- `src/App.js` (commit `4692268`): SMS primary + parallel outbound WA on booking OTP screen; dedicated WA verify path with SMS fallback via `WaSentPanel` → “Use SMS OTP instead”.
- `supabase/functions/whatsapp-verify/index.ts`: `generate` / `check` / inbound webhook handlers.
- Migrations:
  - `20260811000000_wa_verifications.sql` — base table
  - `20260811000001_wa_verifications_outbound.sql` — `outbound_sent_at`, `outbound_provider`

---

## Prerequisites

1. **Supabase CLI** (one of):

   ```bash
   brew install supabase/tap/supabase
   # or from repo root:
   npx supabase --version
   ```

2. **Login** (required — automated deploy failed without this):

   ```bash
   supabase login
   # or set SUPABASE_ACCESS_TOKEN from https://supabase.com/dashboard/account/tokens
   ```

3. **MSG91 credentials** — **not** in repo `.env` (only `REACT_APP_SUPABASE_*` keys exist there). Copy from [MSG91 dashboard](https://control.msg91.com/):
   - Auth key (same key used for SMS OTP / `send-otp` if already configured)
   - WhatsApp integrated number: `919270194842`
   - Approved WhatsApp template name + namespace (required for cold outbound)

---

## Step 1 — Link project

From repo root:

```bash
cd /path/to/scanverse
supabase link --project-ref rwlwrmmqtedugcreweut
```

---

## Step 2 — Apply database migrations

```bash
supabase db push
```

Expected tables/columns:

| Object | Purpose |
|--------|---------|
| `public.wa_verifications` | Token rows (30 min TTL) |
| `outbound_sent_at` | When outbound WA was sent |
| `outbound_provider` | `msg91` or `twilio` |

RLS is enabled; only the edge function (service role) accesses this table.

---

## Step 3 — Deploy edge function

```bash
supabase functions deploy whatsapp-verify --no-verify-jwt
```

`verify_jwt = false` is intentional: MSG91/Twilio inbound webhooks have no Supabase JWT. PWA calls still use the anon key via `supabase.functions.invoke`.

**Note:** As of last check, the live endpoint returned an **older** webhook-only response shape (`{"received":true,"processed":false,...}`). After deploy, `generate` should return `{ success, token, messageSent, provider, ... }`.

---

## Step 4 — Set Supabase secrets

Run from repo root after `supabase link`. Replace placeholder values from your MSG91 / Twilio dashboards.

```bash
# MSG91 WhatsApp (recommended — same vendor as send-otp for India)
supabase secrets set MSG91_AUTH_KEY=<your-msg91-authkey>
supabase secrets set MSG91_WHATSAPP_INTEGRATED_NUMBER=919270194842
supabase secrets set MSG91_WHATSAPP_TEMPLATE_NAME=<approved-template-name>
supabase secrets set MSG91_WHATSAPP_TEMPLATE_NAMESPACE=<template-namespace>
supabase secrets set MSG91_WHATSAPP_TEMPLATE_LANG=en

# Optional: second body variable if template has {{2}}
# supabase secrets set MSG91_WHATSAPP_TEMPLATE_BODY2=1

# Twilio WhatsApp (optional fallback)
# supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxxxxx
# supabase secrets set TWILIO_AUTH_TOKEN=<token>
# supabase secrets set TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# Optional inbound webhook auth for manual tests
# supabase secrets set WHATSAPP_WEBHOOK_SECRET=<random-secret>
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by Supabase.

### Secret names reference

| Secret | Required for outbound | Notes |
|--------|----------------------|-------|
| `MSG91_AUTH_KEY` | Yes (MSG91 path) | Or `MSG91_WHATSAPP_AUTH_KEY` |
| `MSG91_WHATSAPP_INTEGRATED_NUMBER` | Yes | Digits only: `919270194842` |
| `MSG91_WHATSAPP_TEMPLATE_NAME` | Yes (cold outbound) | Without template, session text only works in 24h window |
| `MSG91_WHATSAPP_TEMPLATE_NAMESPACE` | Usually yes | From MSG91 template details |
| `MSG91_WHATSAPP_TEMPLATE_LANG` | No | Default `en` |
| `TWILIO_*` | Only if using Twilio | Fallback if MSG91 send fails |

---

## Step 5 — MSG91 panel configuration

### A. WhatsApp template (one-time)

Create and get **Meta-approved** template in MSG91, e.g.:

> ScanV verification: Reply VERIFY {{1}} to confirm your booking.

- Map `{{1}}` → verification token (`SCANV-XXXX`)
- Note **template name** and **namespace** for secrets above

### B. Inbound webhook (required for strict verify)

In MSG91: **WhatsApp → Webhook → Inbound messages**

| Field | Value |
|-------|-------|
| URL | `https://rwlwrmmqtedugcreweut.supabase.co/functions/v1/whatsapp-verify` |
| Method | `POST` |

No `action` field needed — the function auto-detects MSG91 inbound payloads (`text`, `messages`, `customer_number`).

When user replies `VERIFY SCANV-A3K7`, the webhook marks the token verified; the PWA `check` poll (every 3s) completes signup.

### C. Outbound

Outbound sends use MSG91 API v5 (`whatsapp-outbound-message/bulk/`) from the edge function — no extra MSG91 webhook for outbound.

---

## Step 6 — Verify deployment

### Test `generate`

```bash
curl -s -X POST \
  "https://rwlwrmmqtedugcreweut.supabase.co/functions/v1/whatsapp-verify" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $REACT_APP_SUPABASE_ANON_KEY" \
  -H "apikey: $REACT_APP_SUPABASE_ANON_KEY" \
  -d '{"action":"generate","mobile":"+91XXXXXXXXXX"}'
```

Expected (200):

```json
{
  "success": true,
  "token": "SCANV-XXXX",
  "messageSent": true,
  "provider": "msg91",
  "instruction": "Reply VERIFY SCANV-XXXX on WhatsApp to confirm."
}
```

If `messageSent: false`, check `sendError` (usually missing template or unapproved template).

### Test `check`

```bash
curl -s -X POST \
  "https://rwlwrmmqtedugcreweut.supabase.co/functions/v1/whatsapp-verify" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $REACT_APP_SUPABASE_ANON_KEY" \
  -H "apikey: $REACT_APP_SUPABASE_ANON_KEY" \
  -d '{"action":"check","token":"SCANV-XXXX"}'
```

Before user replies: `{ "verified": false, "mode": "strict", "note": "Waiting for your WhatsApp reply." }`

### Manual webhook test (optional)

```bash
curl -s -X POST \
  "https://rwlwrmmqtedugcreweut.supabase.co/functions/v1/whatsapp-verify" \
  -H "Content-Type: application/json" \
  -d '{"action":"webhook","token":"SCANV-XXXX","secret":"<WHATSAPP_WEBHOOK_SECRET>"}'
```

---

## Verification modes

| Mode | When | Behavior |
|------|------|----------|
| **Strict** | MSG91/Twilio secrets or `WHATSAPP_WEBHOOK_SECRET` set | Verified only after inbound reply |
| **Honor (dev)** | No provider secrets | Auto-verifies ~10s after generate — local testing only |

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `404` / function not found | Run Step 3 deploy |
| `generate` returns old `{received, processed}` JSON | Redeploy — old function version still live |
| `messageSent: false`, template error | Approve template in Meta; set `MSG91_WHATSAPP_TEMPLATE_*` secrets |
| User gets message but `check` stays false | Configure MSG91 inbound webhook (Step 5B) |
| PWA shows “WhatsApp temporarily unavailable” | Function not deployed or network error |

---

## End-user flow (reference)

1. User enters mobile on signup / booking.
2. App sends SMS via `send-otp` (primary).
3. In parallel, app calls `whatsapp-verify` `generate` → outbound WA to user.
4. If WA send succeeds, UI shows “Reply VERIFY SCANV-XXXX” panel; user can switch to SMS OTP.
5. User replies on WhatsApp → MSG91 webhook → token marked verified.
6. PWA poll succeeds → account creation continues (same as SMS verify).

See also: `supabase/functions/whatsapp-verify/README.md`
