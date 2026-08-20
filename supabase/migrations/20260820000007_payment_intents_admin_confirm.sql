-- Allow admin-confirmed Vyapar UPI payments when webhook is not yet live
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
      IF NEW.verified_via IS NULL OR NEW.verified_via NOT IN ('webhook', 'api', 'vyapar_webhook', 'admin_confirm') THEN
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
