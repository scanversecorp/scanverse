-- Skill Gap Review (SGR) fee — editable via pricing admin (service_id: cl-sgr)
-- parent_id NULL so it does not appear in the Cloud browse grid (Form A1 banner only).

INSERT INTO service_pricing (
  service_id, card, sub_card, service_name, sub_service_name,
  current_amount_paise, new_amount_paise,
  partner_amount_paise, partner_pct, scanv_amount_paise, scanv_pct,
  parent_id, is_category, theme, unit, icon, sort_order, active, service_status
) VALUES (
  'cl-sgr',
  'AI, Cloud & Data Center',
  'Admissions',
  'Skill Gap Review (SGR)',
  'Form A1 · verify · schedule · Razorpay fee',
  50000, 50000,
  35000, 70, 15000, 30,
  NULL, false, 'care', 'fee', '📋', 52, true, 'active'
)
ON CONFLICT (service_id) DO UPDATE SET
  card = EXCLUDED.card,
  sub_card = EXCLUDED.sub_card,
  service_name = EXCLUDED.service_name,
  sub_service_name = EXCLUDED.sub_service_name,
  current_amount_paise = EXCLUDED.current_amount_paise,
  new_amount_paise = EXCLUDED.new_amount_paise,
  partner_amount_paise = EXCLUDED.partner_amount_paise,
  partner_pct = EXCLUDED.partner_pct,
  scanv_amount_paise = EXCLUDED.scanv_amount_paise,
  scanv_pct = EXCLUDED.scanv_pct,
  parent_id = EXCLUDED.parent_id,
  is_category = EXCLUDED.is_category,
  theme = EXCLUDED.theme,
  unit = EXCLUDED.unit,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  active = EXCLUDED.active,
  service_status = EXCLUDED.service_status,
  updated_at = NOW();
