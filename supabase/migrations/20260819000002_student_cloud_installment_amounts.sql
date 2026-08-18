-- Installment amounts (auto-filled when course payments are recorded)

ALTER TABLE public.student_cloud
  ADD COLUMN IF NOT EXISTS installment_1_paise integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS installment_2_paise integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.student_cloud.installment_1_paise IS 'First course-fee installment amount (paise), set on first payment';
COMMENT ON COLUMN public.student_cloud.installment_2_paise IS 'Second course-fee installment amount (paise), set on second payment';
