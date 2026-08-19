# Twilio setup for ScanV

**Last reviewed:** 2026-08-19  
**Business contact:** connect@dcoreglobal.com · +91-9270194842  
**Console:** https://console.twilio.com/ · **Signup:** https://www.twilio.com/try-twilio

---

## Executive summary

| Item | Status |
|------|--------|
| Twilio account | **✅ Done** — ScanV trial account · user logged in 19 Aug 2026 |
| SMS trial + test SMS | **✅ Done** — test SMS sent 19 Aug to verified number (+91-9270194842) |
| Free trial virtual number | **✅ Assigned** — see Console → Phone Numbers → Active numbers |
| Account SID + Auth Token | **⏳ Next** — copy from Console → Account → API keys → set Supabase secrets |
| Supabase secrets (`TWILIO_*`) | **⏳ Pending** — not set yet (19 Aug) |
| Onboarding questionnaire | **⏳ Optional** — finish Business profile if prompted |
| India production SMS | **Blocked without TRAI DLT** — use 2Factor/MSG91 as primary for IN OTP |

---

## How ScanV uses Twilio (code)

Twilio is a **fallback** provider, not primary for India OTP.

| Secret | Purpose |
|--------|---------|
| `TWILIO_ACCOUNT_SID` | API auth |
| `TWILIO_AUTH_TOKEN` | API auth |
| `TWILIO_SMS_FROM` | Outbound SMS sender |
| `TWILIO_VOICE_FROM` | Outbound voice calls (dispatch) |
| `TWILIO_WHATSAPP_FROM` | WhatsApp outbound (e.g. `whatsapp:+14155238886`) |
| `TWILIO_PHONE_NUMBER` | Fallback if `*_FROM` unset |

**Files:**
- `supabase/functions/_shared/notify.ts` — SMS/voice/WhatsApp send; Twilio after MSG91, before 2Factor
- `supabase/functions/booking-dispatch/index.ts` — voice TwiML, call status, inbound SMS webhooks
- `supabase/functions/whatsapp-verify/index.ts` — optional Twilio WhatsApp verify fallback
- `supabase/functions/_shared/vendor-providers.ts` — `vendor_enable_twilio` platform flag (default ON)

**Webhook URLs (configure in Twilio after number exists):**
- SMS inbound: `https://rwlwrmmqtedugcreweut.supabase.co/functions/v1/booking-dispatch?action=inbound-sms`
- Call status: `https://rwlwrmmqtedugcreweut.supabase.co/functions/v1/booking-dispatch?action=call-status`
- WhatsApp inbound: `https://rwlwrmmqtedugcreweut.supabase.co/functions/v1/whatsapp-verify`

See also: `docs/DEPLOY-VENDOR-DISPATCH.md`, `docs/DEPLOY-WHATSAPP-VERIFY.md`, `docs/SECRETS-AND-PINS-INVENTORY.md`.

---

## What's pending right now (2026-08-19)

Console: https://console.twilio.com/ → Account home (ScanV trial account)

**Completed 19 Aug:** SMS trial started · test SMS sent to +91-9270194842.

**Next (Supabase wiring only):**
1. Console → **Account → API keys and Auth tokens** — copy Account SID (`AC…`) + Auth Token
2. Console → **Phone Numbers → Manage → Active numbers** — copy trial number (`+1…`)
3. Run Supabase secrets (replace placeholders; never commit):
   ```bash
   npx supabase secrets set \
     TWILIO_ACCOUNT_SID=ACxxxxxxxx \
     TWILIO_AUTH_TOKEN=xxxxxxxx \
     TWILIO_SMS_FROM=+1xxxxxxxxxx \
     TWILIO_VOICE_FROM=+1xxxxxxxxxx \
     TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
   ```
4. Configure webhooks on the trial number (URLs in [How ScanV uses Twilio](#how-scanv-uses-twilio-code) above)
5. Verify: Admin Hub → Ops Dashboard → `ext-twilio-account` probe green

Optional later: finish onboarding questionnaire · upgrade before trial expiry (30 days)

Trial limits until upgrade: SMS/voice only to **verified numbers** (max 5; signup phone counts).

---

Per [Twilio trial docs](https://www.twilio.com/docs/usage/trials) (2026):

1. **Sign up** at https://www.twilio.com/try-twilio (no credit card for trial).
2. **Verify email** (likely `connect@dcoreglobal.com` if used at signup).
3. **Verify personal phone** — use **+91-9270194842**; this number is auto-added as a verified recipient.
4. **Project questionnaire** — describe ScanV / transactional OTP use case.
5. **Product trial (Messaging → Try out SMS)** — trial assigns a **Twilio-owned trial number**; you do **not** pick a number during signup.
6. **Trial limits (30 days):**
   - ~100 SMS, 75 voice minutes (product-specific free units)
   - SMS/voice only to **verified numbers** (max 5; signup number counts as 1)
   - SMS/voice restricted to **sign-up country** (India ✓ supported)
   - Outbound uses **trial numbers** that may differ by product/recipient
7. **Upgrade** (add payment method) needed to **purchase and keep** a dedicated number and remove trial restrictions.

**India note:** India is in Twilio’s supported trial countries. For **production** SMS to arbitrary Indian mobiles, TRAI DLT registration is required — ScanV already treats **2Factor.in + MSG91** as primary (`docs/REGULATORY-APPROVALS-INDIA.md` F3/F4). Twilio is best for **international fallback**, **voice dispatch**, and **WhatsApp sandbox**.

---

## Audit findings (2026-08-19)

### Credentials search
- `.env` — no Twilio vars (only Supabase/Razorpay/UPI build vars).
- `docs/social/credentials.env` — Meta/Google/social only; **no Twilio section**.
- `docs/social/credentials.template.env` — **no Twilio template** (add if storing locally).
- No `AC…` Account SID committed anywhere in repo.

### Console access attempt
- **Browser MCP:** tab creation succeeded but navigation failed (`No browser tab available`).
- **Playwright:** browser binary not installed; `npx playwright install` blocked by **~98% disk full** on dev machine.
- **OTP:** Not requested — could not reach authenticated console.

### Recommended login for manual check
1. Open https://console.twilio.com/ in your browser (existing session may exist).
2. If login required: use email used at signup (likely **connect@dcoreglobal.com**) + password, or phone **9270194842** for OTP.
3. Check **Account → General** — Trial vs Paid, trial expiry.
4. Check **Phone Numbers → Manage → Active numbers** — any trial or purchased number.
5. Check **Messaging → Try it out** — pending steps for first SMS.
6. Check **Trust Hub / Regulatory** — identity/business verification if buying IN numbers.

---

## Next steps for ScanV

### A. If no Twilio account yet
1. Sign up: https://www.twilio.com/try-twilio with **connect@dcoreglobal.com** and verify **9270194842**.
2. Complete **Messaging → Try out SMS**; note the assigned trial number.
3. Store secrets in Supabase (never commit):
   ```bash
   npx supabase secrets set \
     TWILIO_ACCOUNT_SID=ACxxxxxxxx \
     TWILIO_AUTH_TOKEN=xxxxxxxx \
     TWILIO_SMS_FROM=+1xxxxxxxxxx \
     TWILIO_VOICE_FROM=+1xxxxxxxxxx \
     TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
   ```
4. Configure webhooks (URLs above) on the trial/purchased number.
5. Verify via Admin Hub → Ops Dashboard → API monitoring (`ext-twilio-account` probe).

### B. If account exists but no number
- Complete email/phone verification in console.
- Finish Messaging product trial wizard.
- For a **dedicated** number: upgrade account + buy US toll-free or local number (IN local numbers have regulatory bundle requirements; toll-free may need address outside IN per Twilio IN guidelines).

### C. Production OTP strategy (India)
| Channel | Provider | Status |
|---------|----------|--------|
| Primary SMS OTP | 2Factor.in | Go-live checklist |
| Fallback SMS | MSG91 | DLT template |
| Fallback SMS/voice | Twilio | Optional — trial OK for dev; upgrade + compliance for prod |
| WhatsApp verify | MSG91 primary, Twilio fallback | See `docs/DEPLOY-WHATSAPP-VERIFY.md` |

### D. Dev machine blocker
Free disk space (~4.6 GB / 98% used) prevented Supabase CLI secrets list and doc/script writes during this audit. Free space before `npx playwright install` or large deploys.

---

## Checklist (copy when account is live)

- [x] Twilio account created / logged in (19 Aug 2026)
- [x] Phone 9270194842 verified
- [x] Messaging trial completed — test SMS sent 19 Aug
- [ ] Trial number copied to Supabase secrets: `____________`
- [ ] `TWILIO_*` secrets set in Supabase
- [ ] Webhooks configured on number
- [ ] Ops Dashboard `ext-twilio-account` probe green
- [ ] Test OTP to verified number only (trial restriction)
- [ ] Upgrade decision documented before trial expiry (30 days)

---

*Do not commit Account SID, Auth Token, or phone numbers to git. Update this doc after console login with account email, trial expiry, and assigned number.*
