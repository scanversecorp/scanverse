# ScanV Customer Support — Roles & Access

Internal support desk for searching customers, bookings, and payments. Not linked in public navigation.

## Access URL

```
https://scanv-tau.vercel.app/#customer-support
```

**Admin hub (all tools):** `https://scanv-tau.vercel.app/#admin` — see [ADMIN-HUB.md](./ADMIN-HUB.md)

## Roles

| Role | PIN secret | Permissions |
|------|------------|-------------|
| **Support Agent** (`support_agent`) | `SUPPORT_AGENT_PIN` | Read-only customer search; full ticket desk (queue, timeline, comments, resolve) |
| **Support Admin** (`support_admin`) | `SUPPORT_ADMIN_PIN` | Everything agents can do, plus update profile fields and booking status |

Leaders who already use `PRICING_ADMIN_PIN` or `VENDOR_ADMIN_PIN` are treated as **Support Admin** (full update access).

## PIN setup (Supabase secrets)

Set via Supabase secrets — owner/admin use `ScanV2026`, agents use `ScanV2026Agent`. Do not commit PIN values to git.

From the project root, linked to project `rwlwrmmqtedugcreweut`:

```bash
npx supabase secrets set \
  SUPPORT_AGENT_PIN=<agent-pin> \
  SUPPORT_ADMIN_PIN=<admin-pin>
```

Then deploy the edge function:

```bash
npx supabase functions deploy customer-support --no-verify-jwt
```

PINs must be at least 6 characters. Share agent PIN only with read-only staff; keep admin PIN for team leads.

## Adding support agents (registry)

The `support_agents` table is an optional audit registry. Auth is PIN-based (env secrets), not per-row PINs.

**Preferred:** use the Admin Control Center → **Support Agents** tab at `#admin` (see [ADMIN-HUB.md](./ADMIN-HUB.md)).

Or add manually in Supabase SQL editor or Table Editor:

```sql
insert into public.support_agents (name, email, phone, role, notes)
values (
  'Priya Sharma',
  'priya@dcoreglobal.com',
  '+919876543210',
  'support_agent',
  'Tier-1 support — read only'
);

insert into public.support_agents (name, email, phone, role, notes)
values (
  'Rahul Mehta',
  'rahul@dcoreglobal.com',
  '+919123456789',
  'support_admin',
  'Support lead — can update records'
);
```

Deactivate an agent without removing history:

```sql
update public.support_agents
set active = false, updated_at = now()
where email = 'priya@dcoreglobal.com';
```

## What support can see (read-only for agents)

- **Profile:** name, phone, email, address, city, pincode, mobile verified, created date, GPS
- **Bookings:** service, date, time, status, location, txn_id, amount, paid_at
- **Payments:** amount, method, status, gateway, txn_id
- **Payment intents:** status, verified_via, paid_at
- **Device:** device type, OS, browser, timezone, language, IP, last GPS
- **QR scans / visitor sessions** when linked by mobile or IP

## Admin-only updates

Support Admin can:

- Edit profile: name, phone, email, address, village, city, pincode, status
- Change booking status: `confirmed`, `in_progress`, `completed`, `cancelled`

All updates go through the `customer-support` edge function (service role). Clients never write directly to sensitive tables from the support UI.

## Architecture

```
#customer-support (App.js)
    → POST /functions/v1/customer-support
        Header: x-support-pin
        Actions: search | detail | update (admin) | whoami
    → POST /functions/v1/support-tickets
        Header: x-support-pin (agent actions)
        Actions: search | detail | update_status | add_comment | resolve | stats
    → Supabase service role (profiles, bookings, payments, support_tickets, …)
```

## Support tickets

Public routes (footer links) — **minimal customer experience only**:

| Route | Purpose |
|-------|---------|
| `#faq` | FAQ page (bookings, payments, OTP, tracking) |
| `#report` | Submit issue → ticket number `TKT-{timestamp}` |
| `#track-ticket?id=TKT-…` | Basic status lookup by ticket # + mobile (status, subject, last update — **not** the agent timeline) |

**ServiceNow-style tracking is for agents/admins only:**

| Audience | URL | Experience |
|----------|-----|------------|
| **Support agents** | `#customer-support` → Tickets tab | Full desk: queue, filters, timeline, internal vs customer-visible comments, assignment, resolve with SMS/email |
| **Admins** | `#admin` → Tickets tab | Same full desk + Stats sub-tab |

On resolve, agents can optionally send closure note via SMS (2Factor/MSG91/Twilio) and/or email (requires `RESEND_API_KEY` + `SUPPORT_EMAIL_FROM`).

Deploy:

```bash
npx supabase functions deploy support-tickets --no-verify-jwt
npx supabase db push
```

## Security notes

- Page is hash-only (`#customer-support`) — not in bottom nav or sitemap
- Session PIN stored in `sessionStorage` for 24 hours (same pattern as pricing admin)
- RLS on `support_agents` blocks direct client access; edge function uses service role
- Do not commit PINs to git; use Supabase secrets only
