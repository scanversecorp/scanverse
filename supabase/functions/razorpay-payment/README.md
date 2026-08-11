# razorpay-payment edge function

Verifies ScanV UPI / Razorpay payments before the PWA allows booking to continue.

## Flow

1. PWA calls `register` with `txn_id` + `amount_paise` when payment screen loads.
2. Edge function creates a **dynamic Razorpay payment link** for the exact amount (price + 10% fee + 18% GST).
3. User pays via UPI deep link or opens the Razorpay payment link.
4. PWA polls `check` every 3s after payment starts; continue unlocks only when `verified: true` **and** `amount_ok: true`.
5. Razorpay webhook (`payment.captured` / `payment_link.paid`) marks intent paid server-side only if captured amount ≥ `payment_intents.amount_paise`.
6. Payer UPI VPA (`payment.vpa` when `method=upi`) is stored on `payment_intents.payer_vpa` and returned by `check` for refund processing.

**Limitation:** Manual UPI deep-link payments (GPay/PhonePe to static VPA without Razorpay) are verified only if Razorpay can match the TXN — payer VPA is not auto-captured on that path.

## Security

- Static ₹1 Razorpay embed buttons are **not used** — each booking gets its own payment link.
- `markPaid` rejects payments where Razorpay amount &lt; registered `amount_paise`.
- Client never sets `paymentVerified` without server `check` confirming amount.

## Deploy

```bash
supabase secrets set RAZORPAY_KEY_ID=rzp_live_xxx
supabase secrets set RAZORPAY_KEY_SECRET=xxx   # required for payment links + API check
supabase secrets set RAZORPAY_WEBHOOK_SECRET=whsec_xxx
supabase secrets set APP_URL=https://scanv-tau.vercel.app
supabase functions deploy razorpay-payment
supabase db push   # payment_intents migration
```

If `RAZORPAY_KEY_SECRET` is missing, UPI still works but Razorpay payment links cannot be created.

## Razorpay dashboard

Webhook URL:

```
https://rwlwrmmqtedugcreweut.supabase.co/functions/v1/razorpay-payment
```

Events: `payment.captured`, `payment_link.paid`

## Actions

### register

```json
{ "action": "register", "txn_id": "TXN-123", "amount_paise": 74925, "user_id": "uuid" }
```

Response:

```json
{
  "success": true,
  "txn_id": "TXN-123",
  "amount_paise": 74925,
  "payment_link_url": "https://rzp.io/i/abc",
  "razorpay_configured": true
}
```

### check

```json
{ "action": "check", "txn_id": "TXN-123", "amount_paise": 74925 }
```

Response when paid:

```json
{ "verified": true, "status": "paid", "amount_ok": true, "mode": "api", "payer_vpa": "user@okaxis" }
```

Response when underpaid (e.g. ₹1 test payment):

```json
{ "verified": false, "status": "pending", "amount_ok": false }
```
