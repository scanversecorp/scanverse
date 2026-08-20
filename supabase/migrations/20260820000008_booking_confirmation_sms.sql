-- One confirmation SMS per paid booking (idempotent via confirmation_sms_sent_at)

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS confirmation_sms_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.bookings.confirmation_sms_sent_at IS
  'When customer booking+payment confirmation SMS was sent (at most once)';
