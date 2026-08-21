# ScanV Full Backup — Go-Live Baseline (22 Aug 2026)

**Document created:** 22 Aug 2026, 01:08 IST  
**Email sent:** 22 Aug 2026, 01:20 IST → `scanversecorp@gmail.com` (via Resend / `reports@getscanv.com`)  
**Event:** AI, Cloud & Data Center go-live · post cloud test data cleanup  
**Owner:** ScanVerse Corp · scanversecorp@gmail.com

---

## Backup locations (this Mac)

| Item | Absolute path |
|------|---------------|
| **Primary archive (copy off-site)** | `/Users/samir/Downloads/scanverse/backups/scanv-full-20260822-001530.tar.gz` |
| **Backup folder** | `/Users/samir/Downloads/scanverse/backups/scanv-full-20260822-001530/` |
| **This document** | `/Users/samir/Downloads/scanverse/docs/BACKUP-20260822-GOLIVE.md` |
| **Resend email script** | `/Users/samir/Downloads/scanverse/scripts/send-backup-report-email.mjs` |
| **Machine manifest (JSON)** | `/Users/samir/Downloads/scanverse/backups/scanv-full-20260822-001530/MANIFEST.json` |
| **Human manifest** | `/Users/samir/Downloads/scanverse/backups/scanv-full-20260822-001530/MANIFEST.md` |

### Archive checksum

```
SHA-256: 3eb8607c31826e8c3460f26c3384d8aada59cc2864956516a06f8d8c0f11b782
Size:    31 MB
```

### Folder contents

```
scanv-full-20260822-001530/
├── MANIFEST.json              ← machine-readable version + row counts
├── MANIFEST.md                ← restore quick reference
├── source-de1328f.tar.gz      ← full git tree at commit de1328f (31 MB)
└── data-json/                 ← one JSON file per public table (62 tables, 3,030 rows)
    └── _export-summary.json
```

**Store off-site encrypted** (Google Drive / iCloud / encrypted USB). Never commit `backups/` to git.

---

## Production version (live at backup time)

| Field | Value |
|-------|-------|
| **URL** | https://getscanv.com |
| **App version** | `5.5.4.1787336950647` |
| **JS bundle** | `main.d0a0fbea.js` |
| **Built / deployed** | 2026-08-21T18:29:10Z |
| **Major deploy** | yes |
| **Vercel last-modified** | Fri, 21 Aug 2026 18:38:37 GMT |

---

## Git (code snapshot)

| Field | Value |
|-------|-------|
| **Branch** | `main` |
| **Commit** | `de1328f24a2060addb0729d176037281dd455469` |
| **Message** | `[major] Harden payments: DB booking gate and auth on paid-intent list.` |
| **Commit date** | 2026-08-21T23:58:59 IST |
| **Describe** | `v5.5.3-stable-pre-maint-82-gde1328f` |
| **Tags** | v5.5.2 · v5.5.3 · v5.5.3-stable-pre-maint · v5.5.4-pre-major |
| **Remote** | github.com/scanversecorp/scanverse |

### Recent commits included in backup

1. `de1328f` — [major] Harden payments: DB booking gate and auth on paid-intent list.
2. `16278bb` — Show copyable TXN payment reference in customer booking details.
3. `b07ad93` — [major] Fix underpaid orphan payments creating full-price bookings.
4. `6376048` — Clarify admin All bookings with customer phone and payment source.
5. `fb46eb9` — Show payer UPI on admin All bookings instead of booking UUID.

---

## Supabase

| Field | Value |
|-------|-------|
| **Project ref** | `rwlwrmmqtedugcreweut` |
| **Name** | ScanV |
| **Region** | ap-south-1 |
| **Migrations in repo** | 110 |
| **Latest applied migration** | `20260821000002` |
| **Edge functions** | 13 |

Edge functions: admin-hub, booking-dispatch, customer-support, health-report, otp-delivery-report, platform-config, pricing-admin, razorpay-payment, send-otp, student-cloud, support-tickets, vendor-onboard, whatsapp-verify.

---

## Database snapshot

| Field | Value |
|-------|-------|
| **Backup ID** | `scanv-full-20260822-001530` |
| **Created (IST)** | 22 Aug 2026, 00:15 IST |
| **Export method** | `supabase db query --linked` → JSON per table |
| **Tables exported** | 62 |
| **Total rows** | 3,030 |

### Key row counts

| Table | Rows |
|-------|-----:|
| profiles | 22 |
| bookings | 4 |
| payment_intents | 76 |
| payments | 4 |
| vendor_partners | 212 |
| services / service_pricing | 119 each |
| student_cloud | 0 (cleaned pre-launch) |
| service_requests | 4 |
| support_tickets | 0 |

### pg_dump note

`scripts/backup-db.sh` requires Docker Desktop (not available on backup machine). Also use [Supabase Dashboard → Database → Backups](https://supabase.com/dashboard/project/rwlwrmmqtedugcreweut/settings/addons) for managed daily backups.

---

## Stack versions

| Component | Version |
|-----------|---------|
| Node | v24.19.0 |
| npm | 11.17.0 |
| Supabase CLI | 2.115.0 |
| React | 18.2.0 |
| react-scripts | 5.0.1 |
| @supabase/supabase-js | ^2.39.0 |
| package.json (local) | 5.5.4.1787332036415 |

---

## Not included in backup

- Supabase Edge Function secrets (PINs, API keys)
- Vercel environment variables
- `auth.users` (Supabase Auth accounts)
- Razorpay / Vyapar transaction history at payment gateway (use provider dashboards)

See [SECRETS-AND-PINS-INVENTORY.md](./SECRETS-AND-PINS-INVENTORY.md) for secret names and locations.

---

## Restore quick reference

1. **Code:** `tar xzf source-de1328f.tar.gz` or `git checkout de1328f`
2. **Schema:** `npx supabase db push` from migrations, or Supabase managed restore
3. **Data:** Import from `data-json/*.json` or use Supabase PITR / daily backup
4. **Secrets:** Restore from Supabase Dashboard + Vercel env separately
5. **Verify:** Row counts in `_export-summary.json` vs restored DB

Related: [BACKUP-AND-SCALE.md](./BACKUP-AND-SCALE.md) · [GO-LIVE-CHECKLIST.md](./GO-LIVE-CHECKLIST.md)

---

*ScanV · DCore · scanversecorp@gmail.com · https://getscanv.com*
