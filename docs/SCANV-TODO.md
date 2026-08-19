# ScanV Todo List

**Updated:** 19 Aug 2026, 8:27 PM IST  
**Owners:** Samir + Jasmeen

Track ops and follow-ups here. For full launch gates see [GO-LIVE-CHECKLIST.md](./GO-LIVE-CHECKLIST.md).

---

## Email & Cloudflare

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | **Cloudflare Email Sending via CLI** — run `wrangler login` locally *or* set `CLOUDFLARE_API_TOKEN` with Email Sending permissions | ⏳ Pending | Wrangler is not authenticated in CI/automation. Optional upgrade path; **Resend is live today**. Requires **Workers Paid** on the Cloudflare account. |
| 2 | Enable Cloudflare Email Sending in dashboard (if moving off Resend) | ⏳ Pending | Blocked on Workers Paid plan on account `7f8fbca1…`. |
| 3 | Gmail **Send mail as** for `support@` / `reports@` (manual replies) | ⏳ Optional | [GETSCANV-EMAIL.md](./GETSCANV-EMAIL.md) — use Resend SMTP or "Treat as alias". |
| 4 | Merge SPF on root `@` if both Resend + Cloudflare sending coexist | ⏳ When needed | Keep Cloudflare MX for inbound routing; combine `include:amazonses.com` + Cloudflare send SPF in one TXT. |

### Done (email)

- [x] Resend account + `getscanv.com` domain verified (DKIM/SPF via Cloudflare Domain Connect)
- [x] Supabase secrets: `RESEND_API_KEY`, `SUPPORT_EMAIL_FROM=reports@getscanv.com`, `HEALTH_REPORT_*`
- [x] `health-report` + `support-tickets` deployed; test email + cron path confirmed (Resend)

---

## SEO & India entity

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | **Google Search Console** — verify `getscanv.com`, submit sitemap | ⏳ Manual | GSC verified; **sitemap submit blocked** — no GSC session in CDP Chrome profile (19 Aug agent run) |
| 2 | **Google Business Profile** for ScanV (Pune service area) | ⏳ Manual | Needs verified phone + address when available |
| 3 | **Virtual office / India registered address** | ❌ Not started | [VIRTUAL-OFFICE-INDIA.md](./VIRTUAL-OFFICE-INDIA.md) — CA + provider required |
| 4 | Deploy official-app SEO + static files | ✅ Live | title "ScanV — Official App \| getscanv.com" · GSC meta tag present |
| 5 | **GSC domain verified** for `getscanv.com` | ✅ Done | DNS TXT via Cloudflare · account jasmeen.workmail@gmail.com |
| 6 | Submit sitemap + request indexing | ⏳ Manual | GSC → Sitemaps → `sitemap.xml` — agent could not reach GSC (login required in browser) |
| 7 | **Fix "ScanV coming to?" snippet** | ✅ Deployed | Prod meta live · **IG/FB bio** still needs "Coming soon" removed (see Social) |

---

## Twilio (virtual number / SMS fallback)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Twilio account (ScanV) | ⏳ Login required | CDP Chrome profile hit login page (19 Aug) — session not in copied profile |
| 2 | **Start SMS trial** → free virtual number | ⏳ Blocked | Console login required · [TWILIO-SETUP.md](./TWILIO-SETUP.md) |
| 3 | Supabase `TWILIO_*` secrets | ⏳ After trial | No `TWILIO_*` in Supabase secrets list (19 Aug) |
| 4 | Webhooks on trial number | ⏳ After #2 | booking-dispatch + whatsapp-verify URLs in doc |

---

## Social (@scanvapp)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Daily Instagram Graph API post | ✅ Wired | `scripts/instagram_daily_post.mjs` · cron 10:00 AM IST |
| 2 | GitHub Action cron | ⏳ Push blocked | `.github/workflows/instagram-daily-post.yml` — PAT lacks **`workflow` scope** |
| 2b | **Vercel Cron fallback** | ✅ **Live** | `api/cron/instagram-daily.js` + `vercel.json` · dry-run OK 19 Aug · `GET /api/cron/instagram-daily?dry_run=true` |
| 3 | **Meta secrets on Vercel** | ⏳ Blocked | `META_PAGE_ACCESS_TOKEN` not set — live cron will fail until added in Vercel env |
| 4 | Deploy `public/social/` images | ✅ Live | `https://getscanv.com/social/coming-hot-post.png` serves PNG (deploy `fe9d1ad`) |
| 5 | **Post today @scanvapp** | ⏳ Blocked | No Meta token · IG/MBS not logged in CDP profile · CDP upload UI timeout |
| 6 | **IG bio update** | ⏳ Blocked | Remove "Coming soon" — needs IG/MBS login · copy in [instagram-profile.txt](./social/instagram-profile.txt) |
| 7 | User login outreach (social CTAs) | ✅ Ran | `node scripts/social_services_campaign.mjs` · 19 Aug 8:19 PM IST |
| 8 | Vendor WhatsApp outreach | ⏳ Queued | Outside hours (9:30–19:00 IST) · re-run `node scripts/send_vendor_outreach.mjs` |

---

## Code & deploy

| # | Item | Status | Notes |
|---|------|--------|-------|
| 5 | Commit & push Instagram automation + Twilio docs | ✅ Pushed | `fe9d1ad` on `origin/main` (workflow file excluded — PAT scope) |
| 6 | Update [GETSCANV-EMAIL.md](./GETSCANV-EMAIL.md) — mark Resend setup complete | ⏳ Pending | Doc still shows generic "add Resend" steps. |
| 7 | Mark Resend item done in [GO-LIVE-CHECKLIST.md](./GO-LIVE-CHECKLIST.md) §J | ⏳ Pending | Section J still lists Resend as optional unchecked. |
| 8 | Push **v5.5.3** frontend if not on production yet | ✅ Deployed | Vercel auto-deploy from `fe9d1ad` confirmed |

---

## Health checks & monitoring

| # | Item | Status | Notes |
|---|------|--------|-------|
| 9 | Investigate **1 failing check** in daily health report (69/70 pass) | ✅ Done | False positive: RLS returned HTTP 200 + 0 rows; fixed check to count rows. **70/70** now. |
| 10 | Confirm morning/evening cron emails arrive at `sam@` + `jas@` Gmail | ⏳ Watch | Schedule: 6:00 AM & 5:00 PM IST (`scanv-health-report-am` / `-pm`). |
| 11 | **Agent ops monitor** — review health reports & fix failures | ✅ Active | Runbook: [SCANV-OPS-MONITOR.md](./SCANV-OPS-MONITOR.md). Rule: `.cursor/rules/scanv-ops-monitor.mdc`. Script: `scripts/ops-health-review.mjs`. |

---

## Quick commands

```bash
# Cloudflare CLI auth (local machine)
npx wrangler login
# or
export CLOUDFLARE_API_TOKEN=...   # Email Sending + Zone DNS read

# Check Cloudflare Email Sending DNS (after auth + Workers Paid)
npx wrangler email sending dns get getscanv.com

# Resend secrets (already set — re-run only if rotating key)
npx supabase secrets set \
  RESEND_API_KEY=re_xxxx \
  SUPPORT_EMAIL_FROM=reports@getscanv.com

# Instagram daily (dry run)
node scripts/instagram_daily_post.mjs --dry-run

# Vercel cron dry run (production)
curl -s "https://getscanv.com/api/cron/instagram-daily?dry_run=true"

# Twilio secrets (after SMS trial)
npx supabase secrets set \
  TWILIO_ACCOUNT_SID=ACxxxx \
  TWILIO_AUTH_TOKEN=xxxx \
  TWILIO_SMS_FROM=+1xxxxxxxxxx \
  TWILIO_PHONE_NUMBER=+1xxxxxxxxxx

# Manual health report test
HEALTH_REPORT_SECRET=<secret> node scripts/ops-health-review.mjs
```

---

## Go-live · payments (Vyapar UPI)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 12 | **HDFC Vyapar / UPI live collections** | ⏳ **Blocked — bank** | Owner reached out to **bank** (19 Aug 2026); still working on merchant KYC / VPA activation / webhook side. Go-Live §B items stay open until bank confirms. |
| 13 | Vyapar webhook + `VYAPAR_WEBHOOK_SECRET` + ₹1 UPI test | ⏳ After bank | Depends on §12 — auto-confirm booking flow cannot sign off until live UPI works. |
| 14 | **Razorpay live** backup path | ⏳ Parallel | Can complete while waiting on Vyapar — webhook + phone test does not require HDFC. |
| 15 | **2Factor / DLT / OTP delivery** | ⏳ Parallel | Independent of Vyapar — fix SMS callbacks + delivery report before real bookings. |

**While bank works on Vyapar:** OTP (§A), Razorpay backup (§C), E2E browse/OTP (partial §H), backup drill (§I), device testing (§F).

**Blocked on Vyapar only:** UPI pay at checkout, Vyapar dashboard reconciliation, full E2E payment (§H payment step via UPI).

---

## Not blocking (reference)

Full launch checklist items (OTP/DLT, Vyapar live, Razorpay live, backup drill, app stores) remain in [GO-LIVE-CHECKLIST.md](./GO-LIVE-CHECKLIST.md).
