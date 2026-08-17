-- Student Cloud: AI / Cloud / Data Center admissions + fee tracking

CREATE TABLE IF NOT EXISTS public.student_cloud (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  mobile text NOT NULL,
  mobile_e164 text,
  mobile_verified boolean NOT NULL DEFAULT false,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  experience text NOT NULL DEFAULT '',
  dob date,
  address text NOT NULL DEFAULT '',
  village text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  pincode text NOT NULL DEFAULT '',
  lat double precision,
  lng double precision,
  course_id text,
  course_name text,
  schedule_date date,
  schedule_time text,
  sgr_fee_paise integer NOT NULL DEFAULT 50000,
  sgr_paid_paise integer NOT NULL DEFAULT 0,
  sgr_txn_id text,
  sgr_paid_at timestamptz,
  course_fee_paise integer NOT NULL DEFAULT 0,
  course_paid_paise integer NOT NULL DEFAULT 0,
  discount_paise integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'sgr_pending',
  notes text,
  last_reminder_at timestamptz,
  last_reminder_channel text,
  consultant_due_at timestamptz NOT NULL DEFAULT (now() + interval '72 hours'),
  CONSTRAINT student_cloud_status_check CHECK (status IN (
    'sgr_pending', 'sgr_paid', 'enrolled', 'fee_due', 'completed', 'dropped'
  ))
);

CREATE UNIQUE INDEX IF NOT EXISTS student_cloud_mobile_e164_uidx
  ON public.student_cloud (mobile_e164)
  WHERE mobile_e164 IS NOT NULL;

CREATE INDEX IF NOT EXISTS student_cloud_course_idx ON public.student_cloud (course_id);
CREATE INDEX IF NOT EXISTS student_cloud_status_idx ON public.student_cloud (status);
CREATE INDEX IF NOT EXISTS student_cloud_created_idx ON public.student_cloud (created_at DESC);

CREATE TABLE IF NOT EXISTS public.student_cloud_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  student_id uuid NOT NULL REFERENCES public.student_cloud(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('sgr', 'course')),
  amount_paise integer NOT NULL CHECK (amount_paise > 0),
  txn_id text,
  status text NOT NULL DEFAULT 'captured' CHECK (status IN ('pending', 'captured', 'failed')),
  note text,
  created_by text
);

CREATE INDEX IF NOT EXISTS student_cloud_payments_student_idx
  ON public.student_cloud_payments (student_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.student_cloud_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  student_id uuid NOT NULL REFERENCES public.student_cloud(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('sms', 'call')),
  message text,
  ok boolean NOT NULL DEFAULT false,
  error text,
  pending_paise integer
);

CREATE INDEX IF NOT EXISTS student_cloud_reminders_student_idx
  ON public.student_cloud_reminders (student_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.student_cloud_touch()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS student_cloud_touch ON public.student_cloud;
CREATE TRIGGER student_cloud_touch
  BEFORE UPDATE ON public.student_cloud
  FOR EACH ROW EXECUTE FUNCTION public.student_cloud_touch();

ALTER TABLE public.student_cloud ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_cloud_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_cloud_reminders ENABLE ROW LEVEL SECURITY;

-- Access only via service-role edge function
DROP POLICY IF EXISTS student_cloud_no_direct ON public.student_cloud;
DROP POLICY IF EXISTS student_cloud_payments_no_direct ON public.student_cloud_payments;
DROP POLICY IF EXISTS student_cloud_reminders_no_direct ON public.student_cloud_reminders;
