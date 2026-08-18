-- Harden payment_intents: block anon/authenticated read/write bypass (fake paid intents)

DROP POLICY IF EXISTS "payment_intents_insert" ON public.payment_intents;
DROP POLICY IF EXISTS "payment_intents_select" ON public.payment_intents;
DROP POLICY IF EXISTS "payment_intents_service_update" ON public.payment_intents;

-- No anon/authenticated policies — edge functions use service_role (bypasses RLS)

CREATE OR REPLACE FUNCTION public.payment_intents_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'pending' THEN
      RAISE EXCEPTION 'payment_intents: new rows must be pending';
    END IF;
    IF NEW.verified_via IS NOT NULL THEN
      RAISE EXCEPTION 'payment_intents: verified_via cannot be set on insert';
    END IF;
    IF NEW.paid_at IS NOT NULL THEN
      RAISE EXCEPTION 'payment_intents: paid_at cannot be set on insert';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
      IF NEW.verified_via IS NULL OR NEW.verified_via NOT IN ('webhook', 'api', 'vyapar_webhook') THEN
        RAISE EXCEPTION 'payment_intents: paid status requires trusted verified_via';
      END IF;
      IF NEW.paid_at IS NULL THEN
        RAISE EXCEPTION 'payment_intents: paid status requires paid_at';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_intents_guard ON public.payment_intents;
CREATE TRIGGER trg_payment_intents_guard
  BEFORE INSERT OR UPDATE ON public.payment_intents
  FOR EACH ROW EXECUTE FUNCTION public.payment_intents_guard();
