-- Pre-launch cloud / SGR test cleanup (cutoff: Aug 22 2026 00:00 IST)
-- Dry-run counts:
--   SELECT * FROM ... (see scripts/clean-cloud-test-data.mjs)

BEGIN;

CREATE TEMP TABLE _cloud_cutoff AS
  SELECT '2026-08-21 18:30:00+00'::timestamptz AS t;

CREATE TEMP TABLE _cloud_bookings AS
  SELECT id, txn_id FROM bookings b, _cloud_cutoff c
  WHERE (b.service_id LIKE 'cl-%' OR b.service_id = 'cloud')
    AND b.created_at < c.t;

CREATE TEMP TABLE _cloud_txns AS
  SELECT DISTINCT txn_id FROM (
    SELECT txn_id FROM _cloud_bookings WHERE txn_id IS NOT NULL
    UNION
    SELECT pi.txn_id FROM payment_intents pi, _cloud_cutoff c
    WHERE (pi.service_id LIKE 'cl-%' OR pi.service_id = 'cloud')
      AND pi.created_at < c.t
  ) x;

CREATE TEMP TABLE _cloud_students AS
  SELECT id FROM student_cloud sc, _cloud_cutoff c
  WHERE (sc.course_id LIKE 'cl-%' OR sc.course_id = 'cloud')
    AND sc.created_at < c.t;

CREATE TEMP TABLE _cloud_dispatches AS
  SELECT id FROM booking_dispatch WHERE booking_id IN (SELECT id FROM _cloud_bookings);

DELETE FROM booking_dispatch_attempts WHERE dispatch_id IN (SELECT id FROM _cloud_dispatches);
DELETE FROM booking_dispatch WHERE id IN (SELECT id FROM _cloud_dispatches);
DELETE FROM booking_cancellations WHERE booking_id IN (SELECT id FROM _cloud_bookings);
DELETE FROM payments WHERE txn_id IN (SELECT txn_id FROM _cloud_txns);
DELETE FROM service_requests WHERE txn_id IN (SELECT txn_id FROM _cloud_txns);
DELETE FROM bookings WHERE id IN (SELECT id FROM _cloud_bookings);
DELETE FROM payment_intents WHERE txn_id IN (SELECT txn_id FROM _cloud_txns);
DELETE FROM student_cloud_payments WHERE student_id IN (SELECT id FROM _cloud_students);
DELETE FROM student_cloud WHERE id IN (SELECT id FROM _cloud_students);

COMMIT;
