-- Repair remaining rows where new_amount_paise=200 but current is under ₹100 (e.g. dishwashing, bike wash).

UPDATE service_pricing
SET
  new_amount_paise = current_amount_paise,
  partner_amount_paise = ROUND(current_amount_paise * COALESCE(partner_pct, 70) / 100),
  scanv_amount_paise = current_amount_paise - ROUND(current_amount_paise * COALESCE(partner_pct, 70) / 100),
  updated_at = NOW()
WHERE new_amount_paise <= 200
  AND current_amount_paise > 0;
