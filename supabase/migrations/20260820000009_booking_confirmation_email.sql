-- Idempotent cloud / digital booking confirmation emails

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS confirmation_email_sent_at TIMESTAMPTZ;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.bookings.confirmation_email_sent_at IS
  'When customer booking confirmation email was sent (at most once)';
