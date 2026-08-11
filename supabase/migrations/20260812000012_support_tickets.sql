-- ScanV support ticketing (FAQ report form, agent desk, closure notifications)

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  customer_id text references public.profiles(id) on delete set null,
  reporter_name text not null,
  reporter_mobile text not null,
  reporter_email text,
  category text not null default 'other'
    check (category in ('booking', 'payment', 'service', 'other')),
  subject text not null,
  description text not null,
  status text not null default 'new'
    check (status in ('new', 'in_progress', 'pending_customer', 'resolved', 'closed', 'cancelled')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent')),
  assigned_agent_id uuid references public.support_agents(id) on delete set null,
  booking_id uuid,
  txn_id text,
  closure_note text,
  notify_on_close boolean not null default false,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_tickets_number_idx on public.support_tickets (ticket_number);
create index if not exists support_tickets_mobile_idx on public.support_tickets (reporter_mobile);
create index if not exists support_tickets_status_idx on public.support_tickets (status);
create index if not exists support_tickets_created_idx on public.support_tickets (created_at desc);

create table if not exists public.support_ticket_comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_type text not null default 'system'
    check (author_type in ('customer', 'agent', 'system')),
  author_name text,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists support_ticket_comments_ticket_idx
  on public.support_ticket_comments (ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.support_ticket_comments enable row level security;

-- Public can submit tickets (edge function also uses service role)
create policy support_tickets_anon_insert on public.support_tickets
  for insert to anon, authenticated
  with check (true);

-- Authenticated users may read tickets linked to their profile
create policy support_tickets_own_select on public.support_tickets
  for select to authenticated
  using (customer_id = auth.uid()::text);

create policy support_ticket_comments_anon_insert on public.support_ticket_comments
  for insert to anon, authenticated
  with check (true);

comment on table public.support_tickets is
  'Customer support tickets from #report form. Agent access via support-tickets edge function (service role).';

comment on table public.support_ticket_comments is
  'ServiceNow-style activity timeline for support tickets.';
