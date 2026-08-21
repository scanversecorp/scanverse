-- Capture reporter GPS on #report submissions.

alter table public.support_tickets
  add column if not exists reporter_lat double precision,
  add column if not exists reporter_lng double precision,
  add column if not exists reporter_gps_accuracy double precision,
  add column if not exists reporter_gps_address text,
  add column if not exists reporter_gps_source text,
  add column if not exists reporter_gps_captured_at timestamptz;

comment on column public.support_tickets.reporter_lat is
  'GPS latitude captured when the customer submitted #report.';
comment on column public.support_tickets.reporter_lng is
  'GPS longitude captured when the customer submitted #report.';
