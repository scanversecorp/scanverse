# ScanV — Go-Live Checklist

**Production URL:** [https://scanv-tau.vercel.app](https://scanv-tau.vercel.app)  
**Supabase project:** `rwlwrmmqtedugcreweut`  
**Version:** v5.5.3 · Updated 14 Aug 2026

Use this page before accepting real customer bookings and payments. Tick each box when done.

**Live tracker:** Admin Hub → **Go-Live** tab at [#admin](https://scanv-tau.vercel.app/#admin) — all sections below are mirrored there with switches, secret status, auto checks, and manual tick boxes.

---

## A. SMS OTP — 2Factor.in (SMS, not call)

ScanV sends **SMS first**; voice is only a fallback if SMS fails. If users get calls, fix SMS delivery below.

- [ ] 2Factor.in account active with sufficient wallet/credits
- [ ] `TWOFACTOR_API_KEY` set in Supabase → Edge Functions → Secrets
- [ ] DLT sender ID registered (India TRAI) — e.g. `SCANV`
- [ ] DLT OTP template approved — content matches: `ScanV OTP: {code}` (valid 10 min)
- [ ] Delivery callback URL configured in 2Factor panel:
  ```
  https://rwlwrmmqtedugcreweut.supabase.co/functions/v1/otp-delivery-report?key=<OTP_REPORT_SECRET>
  ```
- [ ] `OTP_REPORT_SECRET` set in Supabase secrets (matches callback `?key=`)
- [ ] Test OTP on a real +91 mobile — SMS arrives within ~30 seconds
- [ ] Admin OTP report shows **delivered** (not failed): [#otp-delivery-report](https://scanv-tau.vercel.app/#otp-delivery-report)
- [ ] *(Optional)* Turn off **voice_otp_fallback** in Admin Hub → Go-Live (SMS-only OTP)

**Admin UI:** [#admin → Go-Live tab](https://scanv-tau.vercel.app/#admin) — runtime switches + secret status (no values shown)

**Docs:** [OTP-DELIVERY-REPORT.md](./OTP-DELIVERY-REPORT.md)

---

## B. UPI / Bank — HDFC Vyapar

| Field | Value |
|-------|-------|
| UPI ID | `dcoreglobalcorporati.82037575@hdfcbank` |
| Payee | DCORE GLOBAL CORPORATION |
| Merchant ID | `82037575` |
| Static QR | `/hdfc-vyapar-qr.png` on production site |

- [ ] HDFC SmartHub / Vyapar merchant KYC **fully approved** for live collections
- [ ] UPI VPA **activated** for incoming payments (not test/sandbox)
- [ ] Static Vyapar QR on standee matches app (`public/hdfc-vyapar-qr.png`)
- [ ] Vyapar payment webhook configured → Supabase `razorpay-payment` function
- [ ] `VYAPAR_WEBHOOK_SECRET` set in Supabase secrets
- [ ] Test UPI payment (₹1 or minimum) — booking auto-confirms without manual “I’ve paid”
- [ ] Payment appears in Vyapar / HDFC merchant dashboard

---

## C. Razorpay (backup payments)

- [ ] Razorpay account in **Live** mode (not Test)
- [ ] `RAZORPAY_KEY_ID` set in Supabase secrets (live key)
- [ ] `RAZORPAY_KEY_SECRET` set in Supabase secrets
- [ ] `RAZORPAY_WEBHOOK_SECRET` set — webhook URL:
  ```
  https://rwlwrmmqtedugcreweut.supabase.co/functions/v1/razorpay-payment
  ```
- [ ] Webhook events enabled: `payment.captured`, `payment_link.paid`
- [ ] `APP_URL=https://scanv-tau.vercel.app` set in Supabase secrets
- [ ] Test Razorpay payment link flow end-to-end on phone

**Docs:** [ALL-APIS-AND-WEBHOOKS.md](./ALL-APIS-AND-WEBHOOKS.md)

---

## D. Production secrets & security

- [ ] `OTP_DEV_MODE` is **unset** or `0` (never `1` in production) — or use Admin Hub → **Go-Live** tab → **otp_dev_mode** switch **OFF**
- [ ] `ADMIN_HUB_PIN` set — not default/demo value
- [ ] `SUPPORT_ADMIN_PIN` set
- [ ] `SUPPORT_AGENT_PIN` set
- [ ] `PRICING_ADMIN_PIN` set
- [ ] `VENDOR_ADMIN_PIN` set
- [ ] `DISPATCH_SECRET` set (protects booking dispatch endpoints)
- [ ] No API keys in client code (`src/App.js`) — OTP/payments server-side only
- [ ] 2Factor API key rotated if it was ever exposed in an old client bundle

**Docs:** [SECRETS-AND-PINS-INVENTORY.md](./SECRETS-AND-PINS-INVENTORY.md) · [SECURITY-AUDIT.md](./SECURITY-AUDIT.md)

---

## E. Messaging fallbacks (recommended)

- [ ] MSG91 auth key set (`MSG91_AUTH_KEY`) if using MSG91 SMS fallback
- [ ] MSG91 DLT template registered (separate from 2Factor DLT)
- [ ] WhatsApp backup OTP configured — see [DEPLOY-WHATSAPP-VERIFY.md](./DEPLOY-WHATSAPP-VERIFY.md)
- [ ] MSG91 WhatsApp template approved for `+91-9270194842`
- [ ] `whatsapp-verify` edge function deployed

---

## F. App & deploy

- [ ] Latest `main` deployed on Vercel (bundle hash changed after last push)
- [ ] QR scan opens services home — no “Add to Home Screen” prompt
- [ ] Printable QR live: [scanv-qr.png](https://scanv-tau.vercel.app/scanv-qr.png)
- [ ] Privacy policy final: [/privacy](https://scanv-tau.vercel.app/privacy)
- [ ] Terms final: [/terms](https://scanv-tau.vercel.app/terms)
- [ ] FAQ / report pages load correctly
- [ ] Mobile layout tested on iPhone + Android (real devices)

**Docs:** [VERSION.md](./VERSION.md)

---

## G. Operations & vendors

- [ ] At least one live vendor partner per priority category (household, food, etc.)
- [ ] Vendor onboarding flow tested (`#vendor-onboard`)
- [ ] Dispatch mode set in admin hub (in-app / external / both)
- [ ] Support desk tested (`#customer-support`) with agent PIN
- [ ] Support phone `+91-9270194842` staffed or forwarded
- [ ] Admin hub accessible: [#admin](https://scanv-tau.vercel.app/#admin)

**Docs:** [ADMIN-HUB.md](./ADMIN-HUB.md) · [DEPLOY-VENDOR-DISPATCH.md](./DEPLOY-VENDOR-DISPATCH.md)

---

## H. End-to-end smoke test (one real phone)

Run this once on a physical device before announcing go-live:

- [ ] Open [scanv-tau.vercel.app](https://scanv-tau.vercel.app) or scan [scanv-qr.png](https://scanv-tau.vercel.app/scanv-qr.png)
- [ ] Browse services → open a service detail
- [ ] Start booking → enter mobile → **Send OTP** → SMS received → verify
- [ ] Complete booking form (address, schedule)
- [ ] Pay via UPI (GPay/PhonePe) or Razorpay
- [ ] Payment auto-confirmed → track screen shows booking
- [ ] Booking visible in admin hub / vendor dispatch (if applicable)

---

## I. Backup & disaster recovery

See full runbook: [BACKUP-AND-SCALE.md](./BACKUP-AND-SCALE.md)

- [ ] Supabase **Pro** plan with **daily backups** enabled (Dashboard → Settings → Database → Backups)
- [ ] Manual dump tested: `./scripts/backup-db.sh` → file in `backups/` (store off-site, encrypted)
- [ ] **Restore drill** completed — backup restored to branch/local DB; bookings + payment_intents row counts verified
- [ ] Secrets inventory exported to owner-local file (not in git) — [SECRETS-AND-PINS-INVENTORY.md](./SECRETS-AND-PINS-INVENTORY.md)

Tick these in Admin → **Go-Live** → Manual checklist (section **I. Backup & DR**).

---

## J. Optional (not blocking web launch)

- [ ] Custom domain (e.g. `app.scanv.com`) pointed to Vercel
- [ ] Google Play Store listing (Capacitor) — [APP-STORE-ROADMAP.md](./APP-STORE-ROADMAP.md)
- [ ] Apple App Store listing (Capacitor)
- [ ] Digio eKYC for strict vendor verification (`DIGIO_*` secrets)
- [ ] Email ticket closure via Resend (`RESEND_API_KEY`, `SUPPORT_EMAIL_FROM`)

---

## Not required

| Item | Reason |
|------|--------|
| AWS EC2 / own server | Frontend on Vercel, backend on Supabase |
| Local `npm install` for customers | They use the live URL or QR |
| PWA “Add to Home Screen” | Removed — browser-first; store apps are optional later |

---

## Quick links

| Resource | URL |
|----------|-----|
| Production app | https://scanv-tau.vercel.app |
| Admin hub | https://scanv-tau.vercel.app/#admin |
| OTP delivery report | https://scanv-tau.vercel.app/#otp-delivery-report |
| Supabase dashboard | https://supabase.com/dashboard/project/rwlwrmmqtedugcreweut |
| 2Factor.in | https://2factor.in |
| Razorpay dashboard | https://dashboard.razorpay.com |

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product / Owner | | | |
| Technical | | | |
| Payments / Finance | | | |

---

*DCORE Global Corporation · ScanV · [scanversecorp/scanverse](https://github.com/scanversecorp/scanverse)*
