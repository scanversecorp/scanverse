-- Track outbound WhatsApp delivery for verify flow

alter table public.wa_verifications
  add column if not exists outbound_sent_at timestamptz,
  add column if not exists outbound_provider text;

comment on column public.wa_verifications.outbound_sent_at is
  'When outbound verification WA was sent to user mobile';
comment on column public.wa_verifications.outbound_provider is
  'msg91 | twilio — provider used for outbound verify message';
