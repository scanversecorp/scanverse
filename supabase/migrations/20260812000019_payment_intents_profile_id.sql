-- payment_intents.user_id was UUID → auth.users, but ScanV profiles use TEXT ids (cust_*).
-- Align with profiles.id so Razorpay register no longer fails on cust_* values.

alter table public.payment_intents
  drop constraint if exists payment_intents_user_id_fkey;

alter table public.payment_intents
  alter column user_id type text using user_id::text;

alter table public.payment_intents
  add constraint payment_intents_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete set null;

comment on column public.payment_intents.user_id is 'TEXT profiles.id (e.g. cust_919270194842), not auth.users UUID';
