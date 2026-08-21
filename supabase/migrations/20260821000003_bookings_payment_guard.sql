-- Require verified paid payment_intents before authenticated customers can insert bookings.

CREATE OR REPLACE FUNCTION public.bookings_require_paid_intent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pi RECORD;
  jwt_role text;
BEGIN
  jwt_role := COALESCE(current_setting('request.jwt.claim.role', true), '');
  IF jwt_role IS DISTINCT FROM 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF NEW.txn_id IS NULL OR btrim(NEW.txn_id) = '' THEN
    RAISE EXCEPTION 'bookings: txn_id required for paid booking';
  END IF;

  SELECT status, amount_paise, verified_via
  INTO pi
  FROM public.payment_intents
  WHERE txn_id = NEW.txn_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'bookings: no payment intent for txn_id %', NEW.txn_id;
  END IF;

  IF pi.status IS DISTINCT FROM 'paid' THEN
    RAISE EXCEPTION 'bookings: payment not confirmed for txn_id %', NEW.txn_id;
  END IF;

  IF pi.verified_via IS NULL OR pi.verified_via NOT IN ('webhook', 'api', 'vyapar_webhook', 'admin_confirm') THEN
    RAISE EXCEPTION 'bookings: payment not verified by gateway for txn_id %', NEW.txn_id;
  END IF;

  IF NEW.total IS NOT NULL AND NEW.total > 0 AND pi.amount_paise < NEW.total THEN
    RAISE EXCEPTION 'bookings: paid amount % paise is below booking total % paise', pi.amount_paise, NEW.total;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bookings_require_paid_intent ON public.bookings;
CREATE TRIGGER trg_bookings_require_paid_intent
  BEFORE INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.bookings_require_paid_intent();

COMMENT ON FUNCTION public.bookings_require_paid_intent IS
  'Blocks authenticated booking inserts unless payment_intents is paid with trusted verified_via and amount >= booking total';
