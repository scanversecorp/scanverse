-- Internal vs customer-visible support ticket comments (agent desk only)

alter table public.support_ticket_comments
  add column if not exists is_internal boolean not null default false;

comment on column public.support_ticket_comments.is_internal is
  'When true, comment is visible to support agents/admins only — not shown on customer status lookup.';
