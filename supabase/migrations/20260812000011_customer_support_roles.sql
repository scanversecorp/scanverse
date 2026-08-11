-- Customer support agents registry (PIN auth via edge function secrets)
create table if not exists public.support_agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  role text not null default 'support_agent'
    check (role in ('support_agent', 'support_admin')),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_agents_role_idx on public.support_agents (role) where active = true;
create index if not exists support_agents_phone_idx on public.support_agents (phone) where phone is not null;

alter table public.support_agents enable row level security;

-- Edge function uses service role; deny direct client access
comment on table public.support_agents is
  'Registry of ScanV customer support staff. Auth via SUPPORT_AGENT_PIN / SUPPORT_ADMIN_PIN edge secrets.';

-- Search helpers on profiles
create index if not exists profiles_phone_idx on public.profiles (phone);
create index if not exists profiles_city_idx on public.profiles (city);
create index if not exists profiles_name_idx on public.profiles (name);
