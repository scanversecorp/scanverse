# ScanV — SMS OTP Delivery Report (2Factor.in)

**Updated:** 12 Aug 2026 · Supabase project `rwlwrmmqtedugcreweut`

---

## Callback URL (paste in 2Factor.in)

Configure in **2Factor control panel → Callback / Delivery Report URL**:

```
https://rwlwrmmqtedugcreweut.supabase.co/functions/v1/otp-delivery-report?key=ScanV2026
```

Set matching secret in Supabase:

```bash
npx supabase secrets set OTP_REPORT_SECRET=ScanV2026
```

If `OTP_REPORT_SECRET` is not set, the webhook accepts all requests (not recommended for production).

---

## What 2Factor sends

2Factor makes a **POST** request when SMS OTP delivery status changes.

| Parameter | Example | Meaning |
|-----------|---------|---------|
| `mode` | `SMS_OTP` | Delivery channel |
| `SessionId` | `c8e46da6-7b5c-4515-a3b2-83bf045cce44` | Session from send API |
| `To` | `9876543210` | Mobile number |
| `Status` | `DELIVERED` | Raw delivery status |

Voice OTP adds: `api_request_time`, `call_start_time`, `call_end_time`, `callDetailStatus`.

---

## Recorded statuses

| 2Factor raw | Stored as |
|-------------|-----------|
| `DELIVERED` | `delivered` |
| `FAILED` | `failed` |
| `REJECTED` | `failed` |
| `PENDING` / `SENT` / `QUEUED` | `pending` |
| Other | `unknown` |

Raw status is preserved in `raw_status` and full payload in `raw_payload` (jsonb).

---

## Database

Table: `otp_delivery_reports`

- Links to `vendor_otp` via `session_id` when `send-otp` stored the 2Factor SessionId
- `otp_context` copied from `vendor_otp.purpose` (general, onboard, etc.)

---

## Admin UI

| URL | Access |
|-----|--------|
| `https://getscanv.com/#otp-delivery-report` | Standalone page |
| `https://getscanv.com/#admin` → **OTP Delivery** tab | Admin hub |

PIN: `ADMIN_HUB_PIN`, `SUPPORT_ADMIN_PIN`, or other admin hub PINs.

Features: today filter, failed-only filter, delivered vs failed counts, session_id and raw status per row.

---

## Edge function

| | |
|---|---|
| **URL** | `GET/POST /functions/v1/otp-delivery-report` |
| **Auth** | Optional `?key=` query param matching `OTP_REPORT_SECRET` |
| **JWT** | Disabled (`verify_jwt = false`) — public webhook |

Deploy:

```bash
npx supabase functions deploy otp-delivery-report --no-verify-jwt
npx supabase functions deploy send-otp --no-verify-jwt
npx supabase functions deploy admin-hub --no-verify-jwt
npx supabase db push
```

---

## Correlation flow

1. `send-otp` calls 2Factor SMS API → receives `Details` (SessionId) in JSON response
2. SessionId saved on `vendor_otp.session_id`
3. 2Factor hits callback URL with same SessionId + Status
4. `otp-delivery-report` inserts row and links `vendor_otp_id` when session matches
