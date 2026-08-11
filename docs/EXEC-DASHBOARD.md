# ScanV Executive Dashboard

Read-only business owner dashboard with KPIs, charts, and platform health metrics.

## Access

| Item | Value |
|------|-------|
| **URL** | `https://scanv-tau.vercel.app/#exec` |
| **Alias** | `https://scanv-tau.vercel.app/#exec-dashboard` |
| **PIN** | `ADMIN_HUB_PIN` or `SUPPORT_ADMIN_PIN` (Supabase secrets) |
| **From admin hub** | `#admin` → Overview → **Executive Dashboard →** |

Other admin PINs (`PRICING_ADMIN_PIN`, `VENDOR_ADMIN_PIN`) do **not** unlock the exec dashboard.

## Sections

1. **KPI row** — Revenue (30d/today/7d), payment success/failed, active users, open tickets, pending dispatch, avg transaction, signups, 24h load index
2. **Payments** — Success vs failed vs pending bar chart, UPI vs Razorpay breakdown, 14-day success trend line
3. **Bookings & Dispatch** — Status donut, dispatch pipeline bars
4. **Support** — Tickets by category/status, agent workload table, resolution time, unassigned queue
5. **Users** — 14-day signup trend, verified mobile count, active users (booked in 30d)
6. **Admin access** — Agent roles, PIN-protected module list, ticket update activity (7d proxy)
7. **Infra & DB** — Table row counts, app version, edge function count, migration count, external links

## API (admin-hub edge function)

```bash
curl -X POST "$SUPABASE_URL/functions/v1/admin-hub" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -H "x-admin-pin: YOUR_OWNER_PIN" \
  -d '{"action":"exec_stats"}'
```

Actions:

- `exec_stats` — Full dashboard payload (KPIs + charts + infra)
- `exec_charts` — Chart subset only (lighter refresh)

## Deploy

```bash
npx supabase functions deploy admin-hub --no-verify-jwt
npm run build
```

Set secrets (if not already):

```bash
npx supabase secrets set ADMIN_HUB_PIN=YourOwnerPin123
npx supabase secrets set SUPPORT_ADMIN_PIN=YourSupportAdminPin123
```

## Notes

- Dashboard is **read-only** — no mutations
- Revenue sums successful `payments` + paid `payment_intents` (amounts in paise, displayed as ₹)
- Load index = bookings + tickets + payment events in the last 24 hours
- Session shares the same 24h admin auth cache as `#admin` (`scanv_admin_auth`)
