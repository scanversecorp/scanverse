-- Store service context on payment intents so paid-but-unbooked flows can be recovered.
alter table public.payment_intents
  add column if not exists service_id text,
  add column if not exists service_name text;

comment on column public.payment_intents.service_id is 'Bookable service id (e.g. dl-sameday) at payment registration';
comment on column public.payment_intents.service_name is 'Human-readable service name at payment registration';
