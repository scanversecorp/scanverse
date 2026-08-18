-- Student Cloud: payment metadata, installments, admin comment

ALTER TABLE public.student_cloud
  ADD COLUMN IF NOT EXISTS installment_1_date date,
  ADD COLUMN IF NOT EXISTS installment_2_date date,
  ADD COLUMN IF NOT EXISTS admin_comment text;

ALTER TABLE public.student_cloud_payments
  ADD COLUMN IF NOT EXISTS payment_by text,
  ADD COLUMN IF NOT EXISTS payment_app text,
  ADD COLUMN IF NOT EXISTS payment_at timestamptz,
  ADD COLUMN IF NOT EXISTS upi_id text;

COMMENT ON COLUMN public.student_cloud.admin_comment IS 'Admin notes on enrollment row';
COMMENT ON COLUMN public.student_cloud_payments.payment_by IS 'Payer name or relation';
COMMENT ON COLUMN public.student_cloud_payments.payment_app IS 'GPay, PhonePe, Paytm, bank transfer, etc.';
COMMENT ON COLUMN public.student_cloud_payments.payment_at IS 'When payment was received (may differ from created_at)';
COMMENT ON COLUMN public.student_cloud_payments.upi_id IS 'UPI VPA or reference';
