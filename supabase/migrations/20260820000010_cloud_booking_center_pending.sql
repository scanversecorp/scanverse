-- Cloud sub-card bookings: expose ScanV/partner split on public catalog; track center pending on bookings.

ALTER TABLE service_prices_public
  ADD COLUMN IF NOT EXISTS scanv_amount_paise INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS partner_amount_paise INTEGER NOT NULL DEFAULT 0;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS course_fee_paise INTEGER,
  ADD COLUMN IF NOT EXISTS scanv_share_paise INTEGER,
  ADD COLUMN IF NOT EXISTS center_pending_paise INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS center_paid_paise INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN bookings.center_pending_paise IS 'Partner/center share still owed by customer (cloud sub-card bookings)';
COMMENT ON COLUMN bookings.scanv_share_paise IS 'ScanV share portion of course/service fee';
COMMENT ON COLUMN bookings.course_fee_paise IS 'Full catalog course/service fee before split';

CREATE OR REPLACE FUNCTION sync_public_prices()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO service_prices_public (
    service_id, price_paise, mrp_paise, top_rated, updated_at,
    parent_id, card, sub_card, service_name, sub_service_name,
    theme, unit, icon, sort_order, active, service_status, is_category,
    scanv_amount_paise, partner_amount_paise
  )
  VALUES (
    NEW.service_id,
    NEW.new_amount_paise,
    GREATEST(NEW.current_amount_paise, ROUND(NEW.new_amount_paise / 0.75)::INTEGER),
    COALESCE(NEW.top_rated, 0),
    NOW(),
    NEW.parent_id,
    NEW.card,
    NEW.sub_card,
    NEW.service_name,
    NEW.sub_service_name,
    COALESCE(NEW.theme, 'default'),
    COALESCE(NEW.unit, 'visit'),
    COALESCE(NEW.icon, '✨'),
    COALESCE(NEW.sort_order, 0),
    COALESCE(NEW.service_status, 'active') = 'active',
    COALESCE(NEW.service_status, CASE WHEN COALESCE(NEW.active, TRUE) THEN 'active' ELSE 'inactive' END),
    COALESCE(NEW.is_category, FALSE),
    COALESCE(NEW.scanv_amount_paise, 0),
    COALESCE(NEW.partner_amount_paise, 0)
  )
  ON CONFLICT (service_id) DO UPDATE SET
    price_paise = EXCLUDED.price_paise,
    mrp_paise = EXCLUDED.mrp_paise,
    top_rated = EXCLUDED.top_rated,
    updated_at = EXCLUDED.updated_at,
    parent_id = EXCLUDED.parent_id,
    card = EXCLUDED.card,
    sub_card = EXCLUDED.sub_card,
    service_name = EXCLUDED.service_name,
    sub_service_name = EXCLUDED.sub_service_name,
    theme = EXCLUDED.theme,
    unit = EXCLUDED.unit,
    icon = EXCLUDED.icon,
    sort_order = EXCLUDED.sort_order,
    active = EXCLUDED.active,
    service_status = EXCLUDED.service_status,
    is_category = EXCLUDED.is_category,
    scanv_amount_paise = EXCLUDED.scanv_amount_paise,
    partner_amount_paise = EXCLUDED.partner_amount_paise;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

UPDATE service_pricing SET updated_at = NOW();
