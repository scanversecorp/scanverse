-- Payment intents: track UPI / Razorpay payments until webhook or API confirms paid
create table if not exists public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  txn_id text unique not null,
  user_id uuid references auth.users (id) on delete set null,
  amount_paise integer not null check (amount_paise > 0),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'expired')),
  razorpay_payment_id text,
  razorpay_payment_link_id text,
  paid_at timestamptz,
  verified_via text, -- webhook | api | callback
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes')
);

create index if not exists payment_intents_txn_id_idx on public.payment_intents (txn_id);
create index if not exists payment_intents_status_idx on public.payment_intents (status);

alter table public.payment_intents enable row level security;

-- Anon/authenticated clients may insert their own pending intents (register before pay)
create policy "payment_intents_insert" on public.payment_intents
  for insert to anon, authenticated
  with check (true);

-- Clients may read intents by txn_id (poll status)
create policy "payment_intents_select" on public.payment_intents
  for select to anon, authenticated
  using (true);

-- Updates only via service role (edge function webhook)
create policy "payment_intents_service_update" on public.payment_intents
  for update to service_role
  using (true)
  with check (true);
