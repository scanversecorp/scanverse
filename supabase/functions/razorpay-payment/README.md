# razorpay-payment edge function

Verifies ScanV UPI / Razorpay payments before the PWA allows booking to continue.

## Flow

1. PWA calls `register` with `txn_id` + `amount_paise` when payment screen loads.
2. User pays via UPI deep link (`tr=` set to `txn_id`) or Razorpay payment link.
3. PWA polls `check` every 3s after UPI opens; continue unlocks only when `verified: true`.
4. Razorpay webhook (`payment.captured` / `payment_link.paid`) marks intent paid server-side.

## Deploy

```bash
supabase secrets set RAZORPAY_KEY_ID=rzp_live_xxx
supabase secrets set RAZORPAY_KEY_SECRET=xxx
supabase secrets set RAZORPAY_WEBHOOK_SECRET=whsec_xxx
supabase functions deploy razorpay-payment
supabase db push   # payment_intents migration
```

## Razorpay dashboard

Webhook URL:

```
https://rwlwrmmqtedugcreweut.supabase.co/functions/v1/razorpay-payment
```

Events: `payment.captured`, `payment_link.paid`

## Actions

### register

```json
{ "action": "register", "txn_id": "TXN-123", "amount_paise": 59000, "user_id": "uuid" }
```

### check

```json
{ "action": "check", "txn_id": "TXN-123" }
```

Response when paid:

```json
{ "verified": true, "status": "paid", "mode": "webhook" }
```
