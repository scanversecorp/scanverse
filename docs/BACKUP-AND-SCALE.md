# ScanV — Backup, Recovery & Scale

**Production:** [https://scanv-tau.vercel.app](https://scanv-tau.vercel.app)  
**Supabase project:** `rwlwrmmqtedugcreweut`  
**Updated:** 14 Aug 2026

This doc covers **platform** backup and load — separate from in-app provider fallbacks (2Factor → MSG91, UPI → Razorpay, etc.) controlled in Admin → **Go-Live** vendor toggles.

---

## Architecture (what scales automatically)

| Layer | Provider | Crash / load |
|-------|----------|--------------|
| Customer PWA | Vercel CDN | Static assets scale globally; no server to patch |
| API + auth + DB | Supabase | Managed Postgres + edge functions; plan limits apply |
| OTP / payments | 2Factor, Razorpay, Vyapar, … | Vendor quotas — use Go-Live toggles to fail over |

**No AWS EC2 required** for normal growth. First bottlenecks are usually Supabase connection limits and external API rate caps.

---

## 1. Database backup (critical)

### Supabase managed backups

1. Open [Supabase → Settings → Database → Backups](https://supabase.com/dashboard/project/rwlwrmmqtedugcreweut/settings/addons).
2. **Production recommendation:** **Pro plan** with **daily backups** (7-day retention minimum).
3. **Optional:** **Point-in-time recovery (PITR)** — restore to any second in the window (best for accidental deletes).

### Manual SQL dump (before migrations / releases)

From repo root (requires `supabase link` to project):

```bash
./scripts/backup-db.sh
```

Output: `backups/scanv-db-YYYYMMDD-HHMMSS.sql` (git-ignored).

Custom output directory:

```bash
BACKUP_DIR=~/ScanV-backups ./scripts/backup-db.sh
```

Run before:

- `npx supabase db push`
- Bulk pricing or catalog edits
- Go-live cutover

---

## 2. Restore drill (quarterly)

**Goal:** prove you can recover bookings and payment data — not just that backups exist.

1. Run `./scripts/backup-db.sh` and note the file path.
2. In Supabase dashboard, create a **branch project** or use a **local restore**:
   ```bash
   npx supabase db reset   # local only — destroys local DB
   psql "$LOCAL_DB_URL" -f backups/scanv-db-YYYYMMDD-HHMMSS.sql
   ```
3. Verify row counts: `bookings`, `payment_intents`, `profiles`, `vendor_partners`.
4. Spot-check one paid booking TXN ID matches Razorpay / Vyapar dashboard.
5. Tick **Restore drill completed** in Admin → Go-Live → Manual checklist.

**RPO / RTO targets (suggested for go-live):**

| Metric | Target |
|--------|--------|
| RPO (max data loss) | ≤ 24 h with daily backups; ≤ minutes with PITR |
| RTO (time to restore service) | ≤ 4 h for full DB restore + edge redeploy |

---

## 3. Code & secrets backup

| Asset | Where |
|-------|--------|
| Application code | GitHub `scanversecorp/scanverse` — tag releases (`v5.5.3`) |
| DB schema | `supabase/migrations/` in git |
| Edge functions | `supabase/functions/` in git |
| Secrets (PINs, API keys) | Supabase Edge Function secrets only — **export inventory** to owner-local `LOCAL-OWNER-INVENTORY.md` (never commit) |
| Vercel env | Vercel dashboard → Environment Variables |

Rollback frontend:

```bash
git revert <commit> && git push origin main
```

Rollback edge function:

```bash
git checkout <tag> -- supabase/functions/<name>
npx supabase functions deploy <name> --no-verify-jwt
```

---

## 4. Load & scaling checklist

### Already handled

- Vercel CDN for static PWA
- Supabase connection pooler (pooler URL in project settings)
- Vendor toggles to shed load on failing providers
- `pg_cron` dispatch tick (every minute)

### Before high traffic (festivals, marketing push)

- [ ] Supabase **Pro** — higher connections and backups
- [ ] Monitor Supabase **Database → Reports** (CPU, connections, slow queries)
- [ ] Confirm 2Factor / Razorpay wallet balances topped up
- [ ] Run `node scripts/loadtest.mjs` against staging (optional)
- [ ] Index hot tables if queries slow (`bookings`, `otp_delivery_reports`, `vendor_partners`)
- [ ] Keep `otp_dev_mode` **OFF** in production

### If OTP or payments spike

1. Admin → Go-Live — disable failing vendor, enable backup route.
2. Check [#otp-delivery-report](https://scanv-tau.vercel.app/#otp-delivery-report).
3. Temporarily raise 2Factor wallet / Razorpay limits with provider.

---

## 5. Incident quick reference

| Symptom | First action |
|---------|----------------|
| Site blank / 502 | Check [Vercel status](https://www.vercel-status.com/) and redeploy |
| DB errors in app | Supabase dashboard → Logs; check connection count |
| OTP all failing | Go-Live toggles; 2Factor wallet; OTP report tab |
| Payments not confirming | Vyapar webhook + `vendor_enable_vyapar_upi`; Razorpay webhook |
| Data accidentally deleted | Stop writes; restore from PITR or latest dump |

Support: **+91-9270194842**

---

## Related docs

- [GO-LIVE-CHECKLIST.md](./GO-LIVE-CHECKLIST.md)
- [SECRETS-AND-PINS-INVENTORY.md](./SECRETS-AND-PINS-INVENTORY.md)
- [ADMIN-HUB.md](./ADMIN-HUB.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
