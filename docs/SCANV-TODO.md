# ScanV Todo List

**Updated:** 19 Aug 2026  
**Owners:** Samir + Jasmeen

Track ops and follow-ups here. For full launch gates see [GO-LIVE-CHECKLIST.md](./GO-LIVE-CHECKLIST.md).

---

## Email & Cloudflare

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | **Cloudflare Email Sending via CLI** — run `wrangler login` locally *or* set `CLOUDFLARE_API_TOKEN` with Email Sending permissions | ⏳ Pending | Wrangler is not authenticated in CI/automation. Optional upgrade path; **Resend is live today**. Requires **Workers Paid** on the Cloudflare account. |
| 2 | Enable Cloudflare Email Sending in dashboard (if moving off Resend) | ⏳ Pending | Blocked on Workers Paid plan on account `7f8fbca1…`. |
| 3 | Gmail **Send mail as** for `support@` / `reports@` (manual replies) | ⏳ Optional | [GETSCANV-EMAIL.md](./GETSCANV-EMAIL.md) — use Resend SMTP or “Treat as alias”. |
| 4 | Merge SPF on root `@` if both Resend + Cloudflare sending coexist | ⏳ When needed | Keep Cloudflare MX for inbound routing; combine `include:amazonses.com` + Cloudflare send SPF in one TXT. |

### Done (email)

- [x] Resend account + `getscanv.com` domain verified (DKIM/SPF via Cloudflare Domain Connect)
- [x] Supabase secrets: `RESEND_API_KEY`, `SUPPORT_EMAIL_FROM=reports@getscanv.com`, `HEALTH_REPORT_*`
- [x] `health-report` + `support-tickets` deployed; test email + cron path confirmed (Resend)

---

## SEO & India entity

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | **Google Search Console** — verify `getscanv.com`, submit sitemap | ⏳ Manual | GSC verified; **retry sitemap submit** → `sitemap.xml` |
| 2 | **Google Business Profile** for ScanV (Pune service area) | ⏳ Manual | Needs verified phone + address when available |
| 3 | **Virtual office / India registered address** | ❌ Not started | [VIRTUAL-OFFICE-INDIA.md](./VIRTUAL-OFFICE-INDIA.md) — CA + provider required |
| 4 | Deploy official-app SEO + static files | ✅ Live | `4bf9f8c` · title "ScanV — Official App \| getscanv.com" |
| 5 | **GSC domain verified** for `getscanv.com` | ✅ Done | DNS TXT via Cloudflare · account jasmeen.workmail@gmail.com |
| 6 | Submit sitemap + request indexing | ⏳ Manual | GSC → Sitemaps → `sitemap.xml`; URL Inspection → `/` + `/scanv-brand.html` — **retry after deploy** |
| 7 | **Fix “ScanV coming to?” snippet** | ✅ Deployed | Update live IG/FB bio — remove "Coming soon" |

---

## Social automation (@scanvapp)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Daily Instagram Graph API post | ✅ Wired | `scripts/instagram_daily_post.mjs` · cron 10:00 AM IST |
| 2 | GitHub Action cron | ⏳ Push blocked | Commit `8439e37` local — PAT needs **`workflow` scope** to push `.github/workflows/` |
| 2b | **Vercel Cron fallback** | ✅ Added | `api/cron/instagram-daily.js` + `vercel.json` — deploy + set `CRON_SECRET` + Meta env on Vercel |
| 3 | **Meta secrets** | ⏳ OTP-only | No `META_PAGE_ACCESS_TOKEN` locally or in GitHub — one-time Meta Developer setup · [AUTOMATION.md](./social/AUTOMATION.md) |
| 4 | Deploy `public/social/` images | ⏳ Push | `/social/*.png` serves SPA HTML until push + Vercel deploy (verified 19 Aug) |
| 5 | **Post today @scanvapp** | ⏳ Blocked | Meta API: no token · Cursor browser MCP: tab unavailable · manual: Meta Business Suite or `credentials.env` + `node scripts/instagram_daily_post.mjs` |
| 6 | **IG bio update** | ⏳ Manual | Copy from [instagram-profile.txt](./social/instagram-profile.txt) — remove any "Coming soon" |
| 7 | User login outreach (social CTAs) | ✅ Content ready | `node scripts/social_services_campaign.mjs` · register URL `?utm_source=social&utm_medium=user_register` |
| 8 | Vendor WhatsApp outreach | ⏳ OTP-only | Needs `ADMIN_HUB_PIN` in env + daytime window (9:30–19:00 IST) · `node scripts/send_vendor_outreach.mjs` |

---

## Code & deploy

| # | Item | Status | Notes |
|---|------|--------|-------|
| 5 | Commit & push `notify.ts` (Cloudflare send fallback + `reports@getscanv.com` default) | ⏳ Pending | Deployed to Supabase; local git diff not committed. |
| 6 | Update [GETSCANV-EMAIL.md](./GETSCANV-EMAIL.md) — mark Resend setup complete | ⏳ Pending | Doc still shows generic “add Resend” steps. |
| 7 | Mark Resend item done in [GO-LIVE-CHECKLIST.md](./GO-LIVE-CHECKLIST.md) §J | ⏳ Pending | Section J still lists Resend as optional unchecked. |
| 8 | Push **v5.5.3** frontend if not on production yet | ⏳ Check | [VERSION.md](./VERSION.md) — local tag may still need Vercel deploy. |

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

# Manual health report test
HEALTH_REPORT_SECRET=<secret> node scripts/ops-health-review.mjs

# Or curl directly
curl -X POST 'https://rwlwrmmqtedugcreweut.supabase.co/functions/v1/health-report' \
  -H 'Content-Type: application/json' \
  -H 'x-health-report-secret: <HEALTH_REPORT_SECRET>' \
  -d '{"slot":"morning"}'
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
