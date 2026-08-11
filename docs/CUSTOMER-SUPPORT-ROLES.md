# ScanV Customer Support — Roles & Access

Internal support desk for searching customers, bookings, and payments. Not linked in public navigation.

## Access URL

```
https://scanv-tau.vercel.app/#customer-support
```

## Roles

| Role | PIN secret | Permissions |
|------|------------|-------------|
| **Support Agent** (`support_agent`) | `SUPPORT_AGENT_PIN` | Read-only: search customers, view profile, bookings, payments, payment intents, device/location data |
| **Support Admin** (`support_admin`) | `SUPPORT_ADMIN_PIN` | Everything agents can do, plus update profile fields and booking status |

Leaders who already use `PRICING_ADMIN_PIN` or `VENDOR_ADMIN_PIN` are treated as **Support Admin** (full update access).

## PIN setup (Supabase secrets)

From the project root, linked to project `rwlwrmmqtedugcreweut`:

```bash
npx supabase secrets set \
  SUPPORT_AGENT_PIN=YourAgentPin123 \
  SUPPORT_ADMIN_PIN=YourAdminPin456
```

Then deploy the edge function:

```bash
npx supabase functions deploy customer-support --no-verify-jwt
```

PINs must be at least 6 characters. Share agent PIN only with read-only staff; keep admin PIN for team leads.

## Adding support agents (registry)

The `support_agents` table is an optional audit registry. Auth is PIN-based (env secrets), not per-row PINs.

Add an agent in Supabase SQL editor or Table Editor:

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
    → Supabase service role (profiles, bookings, payments, payment_intents, …)
```

## Security notes

- Page is hash-only (`#customer-support`) — not in bottom nav or sitemap
- Session PIN stored in `sessionStorage` for 24 hours (same pattern as pricing admin)
- RLS on `support_agents` blocks direct client access; edge function uses service role
- Do not commit PINs to git; use Supabase secrets only
