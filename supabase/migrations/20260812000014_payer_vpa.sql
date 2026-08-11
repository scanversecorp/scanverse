-- Store payer UPI VPA from Razorpay for refund processing
alter table public.payment_intents
  add column if not exists payer_vpa text;

alter table public.payments
  add column if not exists payer_vpa text;

comment on column public.payment_intents.payer_vpa is 'Customer UPI ID (VPA) from Razorpay payment entity';
comment on column public.payments.payer_vpa is 'Customer UPI ID (VPA) captured at booking for refunds';
