# ScanV logistics business — autonomous runbook

## Partner pipeline (admin)

**Tab:** `#admin?tab=logistics`

Tracks Porter, Borzo, Shadowfax, QWQER, Delhivery. Pre-seeded with email_sent + follow-up due in 5 days.

| Action | When |
|--------|------|
| Mark replied | Partner responds |
| Mark follow-up sent | After Day 5 nudge |
| Open follow-up mail | Pre-filled mailto |

## Product readiness

- Delivery bookings: **pickup + drop** on schedule screen (`parent === delivery`)
- DB: `external_logistics_trips`, `logistics_partner_pipeline`
- Edge: `quote_external_trip`, `create_external_trip` (stubs until API secrets)

## When sandbox keys arrive

1. Supabase secrets: `PORTER_API_KEY`, `BORZO_API_TOKEN`, etc.
2. Wire provider client in `external-logistics.ts`
3. After payment → `create_external_trip` → webhooks → `#track`

## ScanV / DCore outreach

- From: connect@dcoreglobal.com
- Templates: `docs/email-*-plain.txt`
- Follow-up: `docs/email-followup-plain.txt`
