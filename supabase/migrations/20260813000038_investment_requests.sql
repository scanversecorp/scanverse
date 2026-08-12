-- ScanV: customer investment requirement requests

CREATE TABLE IF NOT EXISTS public.investment_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number    TEXT NOT NULL UNIQUE,
  customer_id       TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  customer_name     TEXT NOT NULL,
  customer_mobile   TEXT NOT NULL,
  customer_email    TEXT,
  investment_type   TEXT NOT NULL,
  amount_range      TEXT NOT NULL,
  time_horizon      TEXT,
  investment_goal   TEXT,
  risk_appetite     TEXT,
  notes             TEXT,
  status            TEXT NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new', 'in_progress', 'responded', 'closed')),
  agent_response    TEXT,
  responded_by      TEXT,
  responded_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investment_requests_status
  ON public.investment_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_investment_requests_customer
  ON public.investment_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_investment_requests_mobile
  ON public.investment_requests(customer_mobile);

ALTER TABLE public.investment_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS investment_requests_insert ON public.investment_requests;
CREATE POLICY investment_requests_insert ON public.investment_requests
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = public.current_profile_id());

DROP POLICY IF EXISTS investment_requests_own_select ON public.investment_requests;
CREATE POLICY investment_requests_own_select ON public.investment_requests
  FOR SELECT TO authenticated
  USING (customer_id = public.current_profile_id());

COMMENT ON TABLE public.investment_requests IS
  'Customer investment requirement forms. Agent/admin access via edge functions (service role).';
