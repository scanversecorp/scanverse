-- Cancel duplicate active bookings per txn_id (keep oldest), then enforce uniqueness.
-- Safe to re-run: only touches rows where rn > 1 among non-cancelled bookings.

WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY txn_id
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM public.bookings
  WHERE txn_id IS NOT NULL
    AND txn_id <> ''
    AND status <> 'cancelled'
)
UPDATE public.bookings b
SET status = 'cancelled'
FROM ranked r
WHERE b.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_txn_id_active_unique
  ON public.bookings (txn_id)
  WHERE txn_id IS NOT NULL
    AND txn_id <> ''
    AND status <> 'cancelled';

COMMENT ON INDEX public.bookings_txn_id_active_unique IS
  'One active booking per Razorpay txn_id; cancelled rows excluded';
