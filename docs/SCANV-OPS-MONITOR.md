# ScanV Ops Monitor — Agent Runbook

**Owner:** Cursor agent (on request or scheduled automation)  
**Human owners:** Samir + Jasmeen (`sam@getscanv.com`, `jas@getscanv.com`)

The agent monitors ScanV production health, reviews scheduled reports, and **fixes or documents** anything that fails.

---

## Schedule

| When | What |
|------|------|
| **6:00 AM IST** | Cron → `health-report` (morning) → email |
| **5:00 PM IST** | Cron → `health-report` (evening) → email |
| **After each report** (or daily session) | Agent reviews failures + `docs/SCANV-TODO.md` |

---

## On every health review

1. **Run** `node scripts/ops-health-review.mjs` (or read the latest health email).
2. **If `failed === 0`** — note pass count; clear related todo items; stop.
3. **If any `FAIL`** — for each failure:
   - Identify suite: Security / Application / Infra
   - Reproduce via Admin → `#admin?tab=health` or the script output
   - **Fix** (secret, deploy, RLS, config, code) — smallest correct change
   - Redeploy affected edge functions if needed
   - Re-run until `failed: 0`
   - Update `docs/SCANV-TODO.md` with what was fixed
4. **If warnings only** — triage; fix if production-risk (e.g. missing `OTP_REPORT_SECRET`); else log in todo as optional.
5. **Scan** `docs/SCANV-TODO.md` + `GO-LIVE-CHECKLIST.md` for open ops items when doing a full ScanV review.

---

## Failure playbooks (common)

| Check | Likely cause | Action |
|-------|--------------|--------|
| `otp-report-secret` | `OTP_REPORT_SECRET` unset | Set Supabase secret; redeploy `otp-delivery-report` |
| `pay-intents-read` | RLS leak | Migration / policy fix |
| `send-otp` | SMS provider / 2Factor | Check `TWOFACTOR_API_KEY`, wallet, DLT |
| `go-live-vendors` | Vendor switch OFF | Admin Go-Live tab or DB `platform_settings` |
| `diagram-count` | Catalog drift | Update `admin-diagrams-data.json` or fix count |
| `health-report-no-secret` | Cron auth broken | Vault `scanv_health_report_secret` vs edge secret |
| Email `ok: false` | Resend / domain | Resend dashboard, DNS, `RESEND_API_KEY` |

---

## Commands

```bash
# Full review (JSON + human summary)
node scripts/ops-health-review.mjs

# Manual trigger (same as cron)
curl -X POST 'https://rwlwrmmqtedugcreweut.supabase.co/functions/v1/health-report' \
  -H 'Content-Type: application/json' \
  -H 'x-health-report-secret: <HEALTH_REPORT_SECRET>' \
  -d '{"slot":"morning"}'

# Redeploy after notify/health fix
npx supabase functions deploy health-report --no-verify-jwt
```

---

## Escalation

- **Cannot fix in code** (payments KYC, DLT approval) → add row to `SCANV-TODO.md`, note in health email reply context.
- **Repeated same failure 3+ runs** → prioritize root-cause fix over silencing checks.
- **Security fail** → treat as urgent; do not defer.

---

## Related docs

- [SCANV-TODO.md](./SCANV-TODO.md) — open ops items
- [GETSCANV-EMAIL.md](./GETSCANV-EMAIL.md) — inbound/outbound mail
- [GO-LIVE-CHECKLIST.md](./GO-LIVE-CHECKLIST.md) — launch gates
