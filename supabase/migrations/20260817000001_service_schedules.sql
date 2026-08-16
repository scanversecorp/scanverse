-- Per-service booking schedule (Schedule Input File) — admin-editable, applies to all vendors.

CREATE TABLE IF NOT EXISTS public.service_schedules (
  service_id TEXT PRIMARY KEY REFERENCES public.services(id) ON DELETE CASCADE,
  parent_id TEXT,
  min_lead_minutes INT NOT NULL DEFAULT 30 CHECK (min_lead_minutes >= 0),
  slot_minutes INT NOT NULL DEFAULT 30 CHECK (slot_minutes BETWEEN 5 AND 240),
  enforce_schedule BOOLEAN NOT NULL DEFAULT true,
  allow_outside_schedule BOOLEAN NOT NULL DEFAULT false,
  windows JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT
);

COMMENT ON TABLE public.service_schedules IS 'Admin schedule input per service — booking windows in IST';
COMMENT ON COLUMN public.service_schedules.enforce_schedule IS 'When false, only min lead time applies; windows are informational';
COMMENT ON COLUMN public.service_schedules.allow_outside_schedule IS 'When enforce_schedule true, customer may opt to book outside windows';

CREATE INDEX IF NOT EXISTS idx_service_schedules_parent ON public.service_schedules(parent_id);

ALTER TABLE public.service_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_schedules_public_read ON public.service_schedules;
CREATE POLICY service_schedules_public_read ON public.service_schedules
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS service_schedules_service_role ON public.service_schedules;
CREATE POLICY service_schedules_service_role ON public.service_schedules
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Default Mon–Sat 9:00–19:00 IST for every catalog service
INSERT INTO public.service_schedules (service_id, parent_id, windows)
SELECT s.id,
  COALESCE(sp.parent_id, s.id),
  '[
    {"day":1,"start":"09:00","end":"19:00"},
    {"day":2,"start":"09:00","end":"19:00"},
    {"day":3,"start":"09:00","end":"19:00"},
    {"day":4,"start":"09:00","end":"19:00"},
    {"day":5,"start":"09:00","end":"19:00"},
    {"day":6,"start":"09:00","end":"19:00"}
  ]'::jsonb
FROM public.services s
LEFT JOIN public.service_pricing sp ON sp.service_id = s.id
ON CONFLICT (service_id) DO NOTHING;
