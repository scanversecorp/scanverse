-- Repair sub-services (and categories) where new_amount_paise was accidentally set to 200 (₹2).
-- Restores New ₹ from Current ₹ and re-syncs service_prices_public via existing trigger.

UPDATE service_pricing
SET
  new_amount_paise = current_amount_paise,
  partner_amount_paise = ROUND(current_amount_paise * COALESCE(partner_pct, 70) / 100),
  scanv_amount_paise = current_amount_paise - ROUND(current_amount_paise * COALESCE(partner_pct, 70) / 100),
  updated_at = NOW()
WHERE new_amount_paise <= 200
  AND current_amount_paise > 10000;

COMMENT ON TABLE service_pricing IS 'Single source of truth for catalog prices — syncs to service_prices_public on change';
