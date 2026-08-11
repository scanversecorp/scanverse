# ScanV Admin Control Center

Unified leader hub for pricing, customer support, agent management, vendors, bookings, and platform settings. Not linked in public navigation.

## Access URL

```
https://scanv-tau.vercel.app/#admin
```

Alias: `#admin-hub`

## Auth

Single PIN gate at hub entry. Accepts any of these Supabase secrets (min 6 chars):

| Secret | Access |
|--------|--------|
| `ADMIN_HUB_PIN` | Dedicated hub PIN (recommended) |
| `SUPPORT_ADMIN_PIN` | Hub + support desk admin |
| `PRICING_ADMIN_PIN` | Hub + pricing admin |
| `VENDOR_ADMIN_PIN` | Hub + vendor admin |

`SUPPORT_AGENT_PIN` does **not** unlock the hub (read-only support desk only).

Session stored in `sessionStorage` for 24 hours (same pattern as other admin pages).

## Tabs

| Tab | Features |
|-----|----------|
| **Overview** | Bookings count, revenue, active vendors, pending dispatches, support agents, profiles |
| **Pricing** | Inline pricing table + link to `#pricing-admin` |
| **Customer Support** | Quick customer search + link to `#customer-support` |
| **Tickets** | ServiceNow-style ticket desk (agents/admins only): queue, timeline, status workflow, assignment, internal comments, resolve with SMS/email closure. Stats sub-tab on admin hub. |
| **Support Agents** | CRUD for `support_agents` — add, offboard, reactivate |
| **Vendors & Dispatch** | Dispatch stats + links to `#vendor-admin`, `#vendor-onboard` |
| **Bookings & Payments** | Search bookings by status/TXN; list payment intents |
| **Database / App** | Links to Supabase dashboard, Vercel, key tables, migration list |
| **Settings** | PIN secrets checklist (read-only, no values shown) |

## Support agents management

Only hub admins can manage the `support_agents` registry via the **Support Agents** tab or the `admin-hub` edge function.

### Add an agent (UI)

1. Open `#admin` and unlock with admin PIN
2. Go to **Support Agents** tab → **+ Add agent**
3. Fill name, email, phone, role (`support_agent` or `support_admin`), notes
4. Click **Create agent**

### Offboard / reactivate

- **Offboard** sets `active = false` (history preserved)
- **Reactivate** sets `active = true`

### Edge function actions

```
POST /functions/v1/admin-hub
Header: x-admin-pin: <admin PIN>
Body: { "action": "list_agents" | "create_agent" | "update_agent" | "deactivate_agent", ... }
```

Auth is PIN-based via env secrets — the registry is for audit, not per-row PINs.

## Setup

```bash
# From project root (linked to rwlwrmmqtedugcreweut)
npx supabase secrets set ADMIN_HUB_PIN=YourHubPin123

npx supabase functions deploy admin-hub --no-verify-jwt
npx supabase functions deploy customer-support --no-verify-jwt
npx supabase functions deploy support-tickets --no-verify-jwt

# Migrations (support_tickets — 20260812000012_support_tickets.sql)
npx supabase db push
```

## Architecture

```
#admin (App.js → AdminControlCenter)
    → POST /functions/v1/admin-hub
        Header: x-admin-pin
        Actions: whoami | stats | list_agents | create_agent | update_agent | deactivate_agent | search_bookings | list_payments
    → Supabase service role

Embedded / linked pages (reuse existing logic):
    #pricing-admin   → pricing-admin edge function
    #customer-support → customer-support edge function
    #vendor-admin    → vendor-onboard edge function
```

## Security

- Hash-only route — not in bottom nav or sitemap
- RLS blocks direct client access to `support_agents`; hub uses service role
- Do not commit PINs to git; use Supabase secrets only
- Agent PIN (`SUPPORT_AGENT_PIN`) cannot access hub or agent CRUD
