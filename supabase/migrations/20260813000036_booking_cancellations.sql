-- Customer booking cancellation: 30% fee (18% GST + 12% platform), 70% manual refund queue

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text;

CREATE TABLE IF NOT EXISTS public.booking_cancellations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id text NOT NULL,
  customer_id text NOT NULL,
  txn_id text,
  total_paid_paise integer NOT NULL CHECK (total_paid_paise > 0),
  cancel_fee_paise integer NOT NULL CHECK (cancel_fee_paise >= 0),
  cancel_fee_gst_paise integer NOT NULL CHECK (cancel_fee_gst_paise >= 0),
  cancel_fee_platform_paise integer NOT NULL CHECK (cancel_fee_platform_paise >= 0),
  refund_paise integer NOT NULL CHECK (refund_paise >= 0),
  refund_status text NOT NULL DEFAULT 'refund_pending'
    CHECK (refund_status IN ('refund_pending', 'processing', 'completed', 'rejected')),
  refund_due_by timestamptz NOT NULL,
  process_note text,
  processed_by text,
  processed_at timestamptz,
  cancelled_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS booking_cancellations_booking_unique
  ON public.booking_cancellations (booking_id);

CREATE INDEX IF NOT EXISTS booking_cancellations_customer_idx
  ON public.booking_cancellations (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS booking_cancellations_refund_queue_idx
  ON public.booking_cancellations (refund_status, refund_due_by)
  WHERE refund_status IN ('refund_pending', 'processing');

ALTER TABLE public.booking_cancellations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS booking_cancellations_customer_select ON public.booking_cancellations;
CREATE POLICY booking_cancellations_customer_select ON public.booking_cancellations
  FOR SELECT
  TO authenticated
  USING (public.auth_matches_profile(customer_id));

GRANT SELECT ON public.booking_cancellations TO authenticated;

COMMENT ON TABLE public.booking_cancellations IS
  'Customer cancellations: 30% fee (18% GST + 12% platform of total paid), 70% refund processed manually by support/admin within 7 business days';

COMMENT ON COLUMN public.booking_cancellations.refund_due_by IS
  'SLA target: refund to be completed within 7 business days of cancellation request';
