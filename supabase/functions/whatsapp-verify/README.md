# whatsapp-verify

Supabase Edge Function for ScanV **WhatsApp mobile verification** (backup when SMS OTP fails).

Users open `wa.me/919270194842?text=SCANV VERIFY {token}`; the PWA polls `check` until `verified: true`.

## Deploy

```bash
# From repo root — link project once if needed:
# supabase link --project-ref rwlwrmmqtedugcreweut

# Apply table migration (Supabase SQL editor or CLI):
# supabase db push
# Or run: supabase/migrations/20260811000000_wa_verifications.sql

supabase functions deploy whatsapp-verify --no-verify-jwt
```

Set secrets if using strict webhook mode:

```bash
supabase secrets set WHATSAPP_WEBHOOK_SECRET=your-random-secret
# Optional future MSG91 WhatsApp:
# supabase secrets set MSG91_WHATSAPP_AUTH_KEY=...
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically at runtime.

## API contract

All requests: `POST /functions/v1/whatsapp-verify` with JSON body `{ action, ... }`.

### `generate`

**Request**

```json
{ "action": "generate", "mobile": "+919876543210" }
```

**Response (200)**

```json
{ "success": true, "token": "SCANV-A3K7" }
```

**Errors:** `{ "error": "Invalid mobile number" }`

Token expires in **30 minutes**. Format: `SCANV-` + 4 alphanumeric chars.

### `check`

**Request**

```json
{ "action": "check", "token": "SCANV-A3K7" }
```

**Response (200)**

```json
{ "verified": true, "mobile": "+919876543210" }
```

or

```json
{ "verified": false }
```

PWA polls every **3s** for up to **10 minutes** (`App.js`).

### `webhook` (optional)

Mark a token verified when WhatsApp Business / MSG91 forwards inbound messages.

**Request**

```json
{ "action": "webhook", "token": "SCANV-A3K7", "secret": "<WHATSAPP_WEBHOOK_SECRET>" }
```

or parse message text:

```json
{ "action": "webhook", "message": "SCANV VERIFY SCANV-A3K7", "secret": "..." }
```

**Response**

```json
{ "success": true, "verified": true, "mobile": "+919876543210" }
```

## Verification modes

| Mode | When | Behavior |
|------|------|----------|
| **Honor (default)** | No `WHATSAPP_WEBHOOK_SECRET` / `MSG91_WHATSAPP_AUTH_KEY` | `check` auto-verifies valid tokens **10s** after creation. Assumes user sent the pre-filled WA message. |
| **Webhook (strict)** | Webhook secret or MSG91 key set | `check` returns `verified: true` only after `webhook` action (or manual DB update) marks the row. |

## Database

Table: `public.wa_verifications`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| mobile | text | E.164, e.g. `+919876543210` |
| token | text | unique, `SCANV-XXXX` |
| verified | boolean | default false |
| verified_at | timestamptz | set on verify |
| verified_via | text | `honor`, `webhook`, `msg91`, `admin` |
| created_at | timestamptz | |
| expires_at | timestamptz | 30 min from generate |

RLS enabled; clients cannot read/write directly — only this edge function (service role).

## Limitations (MVP)

- No WhatsApp Business API credentials in repo; inbound message proof is **not** verified unless you wire `webhook` to your WA provider.
- Honor mode does not confirm the user actually sent the WhatsApp message — only that they waited and polled.
- One active token per `generate` call; old tokens for the same mobile are not auto-invalidated (expire by TTL).
- MSG91 WhatsApp integration is stubbed via env flag + `webhook`; full MSG91 parser not implemented.

## Manual admin verify

```sql
update wa_verifications
set verified = true, verified_at = now(), verified_via = 'admin'
where token = 'SCANV-A3K7' and expires_at > now();
```
