-- Second-line refund approval + Razorpay refund tracking

ALTER TABLE public.booking_cancellations
  DROP CONSTRAINT IF EXISTS booking_cancellations_refund_status_check;

ALTER TABLE public.booking_cancellations
  ADD CONSTRAINT booking_cancellations_refund_status_check
  CHECK (refund_status IN (
    'refund_pending',
    'pending_approval',
    'approved',
    'processing',
    'completed',
    'rejected'
  ));

ALTER TABLE public.booking_cancellations
  ADD COLUMN IF NOT EXISTS review_note text,
  ADD COLUMN IF NOT EXISTS approval_requested_by text,
  ADD COLUMN IF NOT EXISTS approval_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS razorpay_refund_id text;

DROP INDEX IF EXISTS booking_cancellations_refund_queue_idx;

CREATE INDEX IF NOT EXISTS booking_cancellations_refund_queue_idx
  ON public.booking_cancellations (refund_status, refund_due_by)
  WHERE refund_status IN ('refund_pending', 'pending_approval', 'approved', 'processing');

COMMENT ON COLUMN public.booking_cancellations.review_note IS
  'Line-1 support note when submitting refund for owner approval';

COMMENT ON COLUMN public.booking_cancellations.approved_by IS
  'Second-line approver — e.g. otp:8484850288 or staff id';

COMMENT ON COLUMN public.booking_cancellations.razorpay_refund_id IS
  'Razorpay rfnd_… after API refund issued post-approval';

-- Default test approver mobile (override via REFUND_APPROVAL_MOBILE secret or platform_settings)
INSERT INTO public.platform_settings (key, value, description, updated_by)
VALUES (
  'refund_approval_mobile',
  '8484850288',
  'Second-line refund approval OTP — 10-digit mobile (testing: Samir)',
  'migration'
)
ON CONFLICT (key) DO NOTHING;
