-- WhatsApp verification tokens (backup when SMS OTP fails)
-- Polled by ScanV PWA via whatsapp-verify edge function

create table if not exists public.wa_verifications (
  id uuid primary key default gen_random_uuid(),
  mobile text not null,
  token text not null unique,
  verified boolean not null default false,
  verified_at timestamptz,
  verified_via text, -- 'honor' | 'webhook' | 'msg91' | 'admin'
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists idx_wa_verifications_token on public.wa_verifications (token);
create index if not exists idx_wa_verifications_mobile on public.wa_verifications (mobile);
create index if not exists idx_wa_verifications_pending
  on public.wa_verifications (expires_at)
  where verified = false;

-- Edge function uses service role; deny direct client access
alter table public.wa_verifications enable row level security;

comment on table public.wa_verifications is
  'Pending/completed WhatsApp verify tokens for ScanV mobile verification backup path';
