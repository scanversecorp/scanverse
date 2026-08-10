# whatsapp-verify

Supabase Edge Function for ScanV **WhatsApp mobile verification** (backup when SMS OTP fails).

## Flow (outbound)

1. PWA calls `generate` with user mobile
2. Server creates token, stores in `wa_verifications`, **sends outbound WhatsApp TO the user**
3. User receives message: `ScanV verification: Reply VERIFY SCANV-XXXX to confirm your booking.`
4. User replies on WhatsApp
5. MSG91/Twilio inbound webhook hits this function → marks token verified
6. PWA polls `check` every 3s until `verified: true`

## Deploy

```bash
# From repo root — link project once if needed:
# supabase link --project-ref rwlwrmmqtedugcreweut

# Apply migrations:
# supabase db push

supabase functions deploy whatsapp-verify --no-verify-jwt
```

### Required secrets (production)

Set at least one outbound provider (MSG91 preferred — same vendor as `send-otp`):

```bash
# MSG91 WhatsApp (recommended for India)
supabase secrets set MSG91_AUTH_KEY=your-msg91-authkey
supabase secrets set MSG91_WHATSAPP_INTEGRATED_NUMBER=919270194842
supabase secrets set MSG91_WHATSAPP_TEMPLATE_NAME=scanv_verify
supabase secrets set MSG91_WHATSAPP_TEMPLATE_NAMESPACE=your_template_namespace
supabase secrets set MSG91_WHATSAPP_TEMPLATE_LANG=en

# Twilio WhatsApp (fallback / sandbox)
supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxxxxx
supabase secrets set TWILIO_AUTH_TOKEN=your_auth_token
supabase secrets set TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# Inbound webhook auth (optional but recommended)
supabase secrets set WHATSAPP_WEBHOOK_SECRET=your-random-secret
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

### Webhook URLs

Point your provider inbound webhook to:

```
POST https://<project-ref>.supabase.co/functions/v1/whatsapp-verify
```

- **MSG91**: WhatsApp → Webhook → Inbound messages → URL above
- **Twilio**: WhatsApp sandbox / number → Messaging webhook → URL above (POST, form-urlencoded)

No `action` field needed for provider webhooks — payload is auto-detected.

## API contract

All PWA requests: `POST /functions/v1/whatsapp-verify` with JSON body `{ action, ... }`.

### `generate`

**Request**

```json
{ "action": "generate", "mobile": "+919876543210" }
```

**Response (200)**

```json
{
  "success": true,
  "token": "SCANV-A3K7",
  "messageSent": true,
  "provider": "msg91",
  "instruction": "Reply VERIFY SCANV-A3K7 on WhatsApp to confirm."
}
```

If outbound send fails:

```json
{
  "success": true,
  "token": "SCANV-A3K7",
  "messageSent": false,
  "sendError": "MSG91 400: template not approved"
}
```

PWA should fall back to SMS OTP when `messageSent` is false.

### `check`

**Request**

```json
{ "action": "check", "token": "SCANV-A3K7" }
```

**Response (200)**

```json
{ "verified": true, "mobile": "+919876543210", "mode": "webhook" }
```

or

```json
{ "verified": false, "mode": "strict", "note": "Waiting for your WhatsApp reply." }
```

PWA polls every **3s** for up to **10 minutes** (`App.js`).

### `webhook`

Manual test or custom integration:

```json
{ "action": "webhook", "token": "SCANV-A3K7", "secret": "<WHATSAPP_WEBHOOK_SECRET>" }
```

Or parse inbound message text:

```json
{ "action": "webhook", "message": "VERIFY SCANV-A3K7", "secret": "..." }
```

Provider payloads (Twilio `Body`/`From`, MSG91 `text`/`messages`) are handled automatically when posted without `action`.

## Verification modes

| Mode | When | Behavior |
|------|------|----------|
| **Strict (production)** | MSG91/Twilio credentials or `WHATSAPP_WEBHOOK_SECRET` set | `check` returns verified only after inbound webhook marks the row |
| **Honor (dev)** | No provider secrets | `check` auto-verifies valid tokens **10s** after creation — for local testing only |

## MSG91 template

Create an approved WhatsApp template, e.g.:

> ScanV verification: Reply VERIFY {{1}} to confirm your booking.

Map `{{1}}` → token via `MSG91_WHATSAPP_TEMPLATE_NAME` and `body_1` component.

## Database

Table: `public.wa_verifications`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| mobile | text | E.164, e.g. `+919876543210` |
| token | text | unique, `SCANV-XXXX` |
| verified | boolean | default false |
| verified_at | timestamptz | set on verify |
| verified_via | text | `honor`, `webhook`, `msg91`, `twilio`, `admin` |
| outbound_sent_at | timestamptz | when outbound WA was sent |
| outbound_provider | text | `msg91` \| `twilio` |
| created_at | timestamptz | |
| expires_at | timestamptz | 30 min from generate |

## Manual admin verify

```sql
update wa_verifications
set verified = true, verified_at = now(), verified_via = 'admin'
where token = 'SCANV-A3K7' and expires_at > now();
```
