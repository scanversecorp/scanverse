# ScanV snapshot — v5.5.4-pre-major

**Created:** 2026-08-17 · **Use before major changes**

## Restore point (code + live site)

| Field | Value |
|-------|-------|
| **Tag** | `v5.5.4-pre-major` |
| **Commit** | `5343d3ff6bc531a97d8cdbb8347b1e5d512c03de` |
| **Short** | `5343d3f` |
| **Message** | Update footer copy and add pre-launch test data purge tooling. |
| **Branch** | `main` |
| **Live URL** | https://scanv-tau.vercel.app |
| **Supabase** | `rwlwrmmqtedugcreweut` |

### What this snapshot includes

- ScanV logo across app + PWA
- Footer: © ScanV · Operated by DCore - All Rights Reserved · Incorporation SF
- Social pre-launch kit (“I'm coming HOT”, brand promise lines)
- Admin social dashboard, Business HQ, vendor leads, dispatch desk
- Pre-launch test data purge tooling (prod DB was cleaned Aug 15)

---

## Say this to restore (agent or dev)

> **Restore ScanV to `v5.5.4-pre-major` / commit `5343d3f`.**

---

## Revert code

```bash
git fetch origin --tags
git checkout v5.5.4-pre-major    # inspect
# Production rollback:
git checkout main
git reset --hard v5.5.4-pre-major
git push origin main --force     # only if intentional prod rollback
```

**Vercel:** Deployments → find commit `5343d3f` → Redeploy.

---

## Database backup (run on your Mac)

`scripts/backup-db.sh` needs **Docker Desktop** + Supabase CLI linked.

```bash
# Install Docker Desktop, then:
cd /Users/samir/Downloads/scanverse
bash scripts/backup-db.sh
# → backups/scanv-db-YYYYMMDD-HHMMSS.sql (store off-site, never commit)
```

**Note:** Automated backup on 2026-08-17 failed here (no Docker/pg_dump). Run locally before major DB migrations.

### Restore database (if you have a .sql dump)

Use Supabase dashboard **SQL** or `psql` with project connection string — only on a staging project first, not prod, unless you intend full restore.

---

## Package version at snapshot

`package.json`: `5.5.3.1786665000000` (semver tag lags; trust git tag `v5.5.4-pre-major`).

---

*DCore · ScanV · [scanversecorp/scanverse](https://github.com/scanversecorp/scanverse)*
