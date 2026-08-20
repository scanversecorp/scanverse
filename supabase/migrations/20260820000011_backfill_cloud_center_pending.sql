-- Backfill center pending for cloud sub-card bookings created before split-payment rollout.

UPDATE bookings b
SET
  course_fee_paise = COALESCE(b.course_fee_paise, sp.new_amount_paise),
  scanv_share_paise = COALESCE(b.scanv_share_paise, sp.scanv_amount_paise),
  center_pending_paise = sp.partner_amount_paise
FROM service_pricing sp
WHERE b.service_id = sp.service_id
  AND b.service_id LIKE 'cl-%'
  AND b.service_id <> 'cl-sgr'
  AND b.center_pending_paise = 0
  AND sp.partner_amount_paise > 0;
