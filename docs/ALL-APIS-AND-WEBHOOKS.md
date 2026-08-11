# ScanV — All APIs & Webhooks

**Updated:** 12 Aug 2026 · Supabase project `rwlwrmmqtedugcreweut`

---

## Supabase Edge Functions

Base URL: `https://rwlwrmmqtedugcreweut.supabase.co/functions/v1/`

All functions have `verify_jwt = false` in `supabase/config.toml`. Auth via headers, webhook signatures, or service role.

---

### 1. `send-otp`

| | |
|---|---|
| **URL** | `POST /functions/v1/send-otp` |
| **Auth** | Supabase anon key (public) |
| **Purpose** | Send and verify OTP SMS for registration/login |

**Actions:**

```json
{ "action": "send", "mobile": "+919876543210" }
{ "action": "verify", "mobile": "+919876543210", "otp": "123456" }
```

**Secrets used:** `TWOFACTOR_API_KEY`, `MSG91_AUTH_KEY`, `TWILIO_*`, `OTP_DEV_MODE`

Stores 2Factor `SessionId` on `vendor_otp.session_id` for delivery report correlation.

---

### 1b. `otp-delivery-report`

| | |
|---|---|
| **URL** | `GET/POST /functions/v1/otp-delivery-report` |
| **Auth** | Optional `?key=` matching `OTP_REPORT_SECRET` |
| **Purpose** | Webhook from 2Factor.in for SMS OTP delivery status |

**Configure in 2Factor.in Delivery Report settings:**

```
https://rwlwrmmqtedugcreweut.supabase.co/functions/v1/otp-delivery-report?key=ScanV2026
```

**POST params from 2Factor:** `mode`, `SessionId`, `To`, `Status`

**Statuses recorded:** `delivered`, `failed`, `pending`, `unknown`

**Admin UI:** `#otp-delivery-report` or `#admin` → OTP Delivery tab

**Secrets used:** `OTP_REPORT_SECRET` (optional), `SUPABASE_SERVICE_ROLE_KEY`

See [OTP-DELIVERY-REPORT.md](./OTP-DELIVERY-REPORT.md) for full details.

---

### 2. `whatsapp-verify`

| | |
|---|---|
| **URL** | `POST /functions/v1/whatsapp-verify` |
| **Auth** | Webhook secret header / Twilio signature |
| **Purpose** | WhatsApp OTP send + inbound verification webhook |

**Webhook URL:** Configure in MSG91/Twilio dashboard → this function URL

**Secrets used:** `MSG91_WHATSAPP_*`, `TWILIO_*`, `WHATSAPP_WEBHOOK_SECRET`

---

### 3. `razorpay-payment`

| | |
|---|---|
| **URL** | `POST /functions/v1/razorpay-payment` |
| **Auth** | Anon key for register/check; `x-razorpay-signature` for webhooks |
| **Purpose** | Payment intent registration, verification, Razorpay webhooks |

**Actions:**

```json
{ "action": "register", "txn_id": "TXN-…", "amount_paise": 74925, "user_id": "uuid" }
{ "action": "check", "txn_id": "TXN-…", "amount_paise": 74925 }
```

**Webhook (Razorpay dashboard):**

```
https://rwlwrmmqtedugcreweut.supabase.co/functions/v1/razorpay-payment
Events: payment.captured, payment_link.paid
```

**Secrets used:** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `APP_URL`

---

### 4. `pricing-admin`

| | |
|---|---|
| **URL** | `GET/POST /functions/v1/pricing-admin` |
| **Auth** | Header `x-pricing-pin: <PRICING_ADMIN_PIN>` |
| **Purpose** | Read/write live service pricing |

**Secrets used:** `PRICING_ADMIN_PIN`, `SUPABASE_SERVICE_ROLE_KEY`

---

### 5. `admin-hub`

| | |
|---|---|
| **URL** | `POST /functions/v1/admin-hub` |
| **Auth** | Header `x-admin-pin: <admin PIN>` |
| **Purpose** | Unified admin: stats, agents CRUD, bookings, payments, exec dashboard |

**Actions:** `whoami`, `stats`, `list_agents`, `create_agent`, `update_agent`, `deactivate_agent`, `search_bookings`, `list_payments`, `exec_stats`, `exec_charts`

**Secrets used:** `ADMIN_HUB_PIN`, `SUPPORT_ADMIN_PIN`, `PRICING_ADMIN_PIN`, `VENDOR_ADMIN_PIN`

---

### 6. `customer-support`

| | |
|---|---|
| **URL** | `POST /functions/v1/customer-support` |
| **Auth** | Header `x-support-pin: <agent or admin PIN>` |
| **Purpose** | Customer search, profile/booking lookup (read-only for agents) |

**Secrets used:** `SUPPORT_AGENT_PIN`, `SUPPORT_ADMIN_PIN`, leader PINs

---

### 7. `support-tickets`

| | |
|---|---|
| **URL** | `POST /functions/v1/support-tickets` |
| **Auth** | Public for create/track; PIN for agent actions |
| **Purpose** | Ticket CRUD, timeline, resolution |

**Public actions:** `create`, `track`

**Agent actions:** `search`, `detail`, `update_status`, `add_comment`, `resolve`, `stats`

**Secrets used:** `SUPPORT_AGENT_PIN`, `SUPPORT_ADMIN_PIN`, `ADMIN_HUB_PIN`, `RESEND_API_KEY`

---

### 8. `vendor-onboard`

| | |
|---|---|
| **URL** | `POST /functions/v1/vendor-onboard` |
| **Auth** | Public for partner registration; `x-vendor-admin-pin` for admin actions |
| **Purpose** | Partner self-registration, eKYC, activation |

**Secrets used:** `VENDOR_ADMIN_PIN`, `DIGIO_*`, `PAN_VERIFY_API_KEY`, `OTP_DEV_MODE`

---

### 9. `booking-dispatch`

| | |
|---|---|
| **URL** | `POST /functions/v1/booking-dispatch` |
| **Auth** | `x-dispatch-secret` or service role bearer for tick/cron |
| **Purpose** | Nearest vendor match, SMS/call/WhatsApp retries |

**Actions:** `start`, `tick`, `respond`, `call-status`, `twiml`, `inbound-sms`

**Webhook URLs:**

```
…/booking-dispatch?action=call-status  (Twilio voice)
…/booking-dispatch?action=inbound-sms    (Twilio SMS)
```

**Secrets used:** `DISPATCH_SECRET`, `TWILIO_*`, `MSG91_*`, `SUPABASE_SERVICE_ROLE_KEY`

---

## Supabase REST API (Client)

| Endpoint | Method | Auth | Usage |
|----------|--------|------|-------|
| `/rest/v1/profiles` | GET/POST/PATCH | Anon + RLS / user JWT | User profiles |
| `/rest/v1/bookings` | GET/POST | Anon + RLS | Bookings |
| `/rest/v1/service_requests` | GET/POST | Anon + RLS | Service requests |
| `/rest/v1/notifications` | GET | User JWT | In-app notifications |
| `/rest/v1/visitor_sessions` | POST | Anon | Silent analytics |
| `/rest/v1/user_locations` | POST | User JWT | GPS consent log |
| `/rest/v1/service_prices_public` | GET | Anon (RLS read) | Live pricing |
| Realtime channel | SUBSCRIBE | Anon | `service_prices_public` changes |

**Client config (public, in App.js):**

- URL: `https://rwlwrmmqtedugcreweut.supabase.co`
- Anon key: publishable key (safe for client with RLS)

---

## External API Integrations

| Provider | API | Called From | Secret Name |
|----------|-----|-------------|-------------|
| 2Factor.in | SMS OTP | `send-otp` / `_shared/notify.ts` | `TWOFACTOR_API_KEY` |
| MSG91 | SMS, WhatsApp | `notify.ts`, `whatsapp-verify` | `MSG91_AUTH_KEY`, `MSG91_WHATSAPP_*` |
| Twilio | SMS, Voice, WhatsApp | `notify.ts`, `booking-dispatch` | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_*_FROM` |
| Razorpay | Payment links, webhooks | `razorpay-payment` | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` |
| Digio | eKYC | `vendor-onboard` | `DIGIO_API_KEY`, `DIGIO_CLIENT_ID`, `DIGIO_CLIENT_SECRET` |
| Resend | Email | `support-tickets` | `RESEND_API_KEY` |
| OpenStreetMap | Reverse geocode | Client `App.js` | None (public) |
| India Post PIN | PIN lookup | Client `App.js` | None (public) |

---

## Webhook Summary

| Source | Target Function | Verification |
|--------|-----------------|--------------|
| Razorpay | `razorpay-payment` | HMAC `x-razorpay-signature` |
| MSG91 WhatsApp | `whatsapp-verify` | `WHATSAPP_WEBHOOK_SECRET` header |
| Twilio WhatsApp | `whatsapp-verify` | Twilio request validation |
| Twilio Voice | `booking-dispatch` | Twilio signature |
| Twilio SMS | `booking-dispatch` | Twilio signature |
| 2Factor.in | `otp-delivery-report` | Optional `?key=` (`OTP_REPORT_SECRET`) |
| pg_cron (internal) | `booking-dispatch?action=tick` | Service role bearer |

---

## Client → Edge Function Invocations (App.js)

| Function | Trigger |
|----------|---------|
| `send-otp` | Registration, login, booking OTP |
| `razorpay-payment` | Payment screen register + poll check |
| `pricing-admin` | `#pricing-admin` CRUD |
| `admin-hub` | `#admin`, `#exec`, `#otp-delivery-report` dashboards |
| `customer-support` | `#customer-support` search |
| `support-tickets` | `#report`, `#track-ticket`, admin ticket desk |
| `vendor-onboard` | `#vendor-onboard`, `#vendor-admin` |
| `booking-dispatch` | After booking confirmed + paid |
