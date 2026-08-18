# ScanV Security Audit — 12 Aug 2026

**Project:** ScanV (scanverse) · Supabase `rwlwrmmqtedugcreweut` · Vercel `getscanv.com`

---

## Executive Summary

| Check | Status | Notes |
|-------|--------|-------|
| `npm run build` | **PASS** | Compiled successfully after fixes |
| `npm audit` | **ACCEPTED RISK** | 28 vulns in dev/build toolchain (react-scripts/jest); no safe fix without breaking change |
| Hardcoded API keys in client | **FIXED** | Removed unused `TWOFACTOR_KEY` and `FAST2SMS_KEY` from `App.js` |
| `.env` in git | **FIXED** | Removed from index (`git rm --cached .env`); remains in `.gitignore` |
| Payment amount validation | **PASS** | Server-side catalog price + `amount_ok` in `razorpay-payment` |
| Payment intents RLS | **PASS** | No anon/authenticated policies; DB trigger enforces trusted `verified_via` on paid |
| Razorpay webhook signature | **PASS** | HMAC-SHA256 verification when `RAZORPAY_WEBHOOK_SECRET` set |
| Edge function auth (PINs) | **PASS** | Admin/support/pricing/vendor routes require PIN headers |
| RLS on sensitive tables | **PASS** | Enabled on pricing, vendors, dispatch, live locations |
| JWT on edge functions | **INTENTIONAL OFF** | All functions use `verify_jwt = false`; auth via PIN/secret headers |

---

## Findings

### Critical — Fixed

#### 1. Hardcoded SMS API keys in client bundle (`src/App.js`)

**Risk:** `TWOFACTOR_KEY` and `FAST2SMS_KEY` were defined in client JavaScript but never used (OTP flows through `send-otp` edge function with `TWOFACTOR_API_KEY` in Supabase secrets).

**Fix applied:** Removed both constants and dead comments. OTP remains server-side only.

#### 2. `.env` tracked in git

**Risk:** Environment file was committed to repository history despite `.gitignore` entry.

**Fix applied:** `git rm --cached .env` — file kept locally, no longer tracked. **Recommend rotating any secrets that were ever in committed `.env`.**

---

### High — Documented / Accepted

#### 3. npm audit — 28 vulnerabilities (9 low, 5 moderate, 14 high)

All vulnerabilities are in **development/build dependencies** (`react-scripts`, `jest`, `webpack-dev-server`, `svgo`, etc.). Safe fixes require `npm audit fix --force` which would install `react-scripts@0.0.0` (breaking).

**Recommendation:** Plan migration to Vite or updated CRA fork when feasible. Production bundle does not include these dev dependencies.

#### 4. Edge functions: JWT verification disabled

All edge functions in `supabase/config.toml` have `verify_jwt = false`. This is intentional for public OTP/payment flows but means:

- Functions rely on **PIN headers**, **webhook signatures**, or **service role** for auth
- `booking-dispatch` tick is open if `DISPATCH_SECRET` is unset (dev fallback)

**Recommendation:** Set `DISPATCH_SECRET` in production; restrict cron to service-role bearer only.

#### 5. Supabase anon key in client

`SB_KEY` (publishable anon key) is embedded in `App.js`. This is standard for Supabase SPAs; security depends on RLS policies.

**Verified:** RLS enabled on `service_pricing`, `service_prices_public`, vendor tables, `booking_dispatch`, `vendor_live_locations`.

---

### Medium — Informational

#### 6. CORS `Access-Control-Allow-Origin: *` on edge functions

All edge functions allow any origin. Acceptable for public API endpoints; PIN/webhook auth provides access control.

#### 7. Admin PIN session in sessionStorage

Admin/support/pricing PINs stored in `sessionStorage` for 24h (same pattern as existing admin pages). XSS on the domain could exfiltrate session — mitigated by CSP on Vercel and no third-party scripts.

#### 8. Payment: manual UPI without Razorpay

Static UPI deep links cannot auto-capture payer VPA. Documented in `razorpay-payment/README.md`. Server `check` action is required before booking continues.

---

## Payment Security Review

```
Client                    Edge Function              Razorpay
  │                            │                        │
  ├─ register(txn, amount) ───►│ create payment_intent  │
  │                            │ create payment link ──►│
  ├─ poll check() ────────────►│ verify amount ≥ expected│
  │◄─ verified + amount_ok ────│                        │
  │                            │◄── webhook (signed) ───│
  └─ continue booking          │ mark paid if amount OK │
```

- Client **never** sets `paymentVerified` without server `check` returning `verified: true` AND `amount_ok: true`
- `handleCheck` only trusts `status: paid` when `verified_via` is `webhook`, `api`, or `vyapar_webhook`
- Anon/authenticated clients **cannot** read or write `payment_intents` (edge function uses service role)
- DB trigger blocks insert with `status != pending` or update to `paid` without trusted `verified_via`
- Client direct `payment_intents` SELECT/UPSERT fallbacks removed from `App.js`
- Underpaid payments (e.g. ₹1 test) rejected server-side
- Webhook signature verified via `RAZORPAY_WEBHOOK_SECRET`

---

## RLS Summary

| Table | RLS | Notes |
|-------|-----|-------|
| `service_pricing` | Yes | Admin-only writes via edge function (service role) |
| `service_prices_public` | Yes | Public read view |
| `vendor_partners` | Yes | Partner data protected |
| `vendor_partner_services` | Yes | |
| `vendor_otp` | Yes | OTP hashes |
| `booking_dispatch` | Yes | Dispatch state |
| `booking_dispatch_attempts` | Yes | Audit log |
| `vendor_live_locations` | Yes | Live tracking |
| `payment_intents` | Yes | No client policies; service role + edge function only; trigger guards paid status |
| `support_tickets` | Via service role | Edge function only |

---

## Fixes Applied (18 Aug 2026 — Payment security)

1. Migration `20260818000007_payment_intents_rls_harden.sql` — dropped permissive anon INSERT/SELECT policies; added trigger guarding paid transitions
2. `razorpay-payment` — `handleCheck` requires trusted `verified_via`; `handleRegister` validates against `service_prices_public`; added `list_paid_for_user` action
3. `src/App.js` — removed client-side `payment_intents` read/upsert bypasses; orphan recovery via edge function
4. `student-cloud` — `paymentCaptured` requires trusted `verified_via`

---

## Fixes Applied (This Audit)

1. Removed unused `TWOFACTOR_KEY` and `FAST2SMS_KEY` from `src/App.js`
2. Untracked `.env` from git index
3. Verified build passes after changes
4. Documented all findings in this file

---

## Fixes Applied (12 Aug 2026 — Full Flow Audit)

1. **Migration `20260812000025`** — `auth_matches_profile()` helper resolves TEXT profile ids (`cust_*`, `partner_*`) via JWT email; fixed dispatch/live-location RLS; added bookings SELECT/INSERT/UPDATE policies including partner `markComplete` UPDATE
2. **`booking-dispatch`** — `DISPATCH_SECRET` fail-closed unless `OTP_DEV_MODE=1` or `DISPATCH_OPEN=1`; `status` action requires booking party auth (customer_id/partner_id/JWT)
3. **`razorpay-payment`** — Reject unsigned webhooks when `RAZORPAY_WEBHOOK_SECRET` unset (except `OTP_DEV_MODE=1`)
4. **`App.js`** — Pass `customer_id`/`partner_id` to dispatch `status` for authorized polling

---

## Recommended Follow-ups

1. Rotate `TWOFACTOR_KEY` that was previously exposed in client (if still active in 2Factor dashboard)
2. Rotate any secrets that were in committed `.env` history
3. Set `DISPATCH_SECRET` in Supabase if not already set
4. Consider `verify_jwt = true` for admin-only functions with service-role calls from edge
5. Plan react-scripts upgrade path for dev dependency CVEs

---

*Audit performed: 12 Aug 2026 · ScanV v5.5.2*
