-- tw-polish and fw-sanitize: even care-theme grids + pricing sync

INSERT INTO service_pricing (
  service_id, card, sub_card, service_name, sub_service_name,
  current_amount_paise, new_amount_paise,
  partner_amount_paise, partner_pct, scanv_amount_paise, scanv_pct
) VALUES
  ('tw-polish', 'Two Wheeler', 'Care', 'Two Wheeler Support', 'Bike Polish & Wax', 11900, 8925, 6248, 70, 2677, 30),
  ('fw-sanitize', 'Four Wheeler', 'Care', 'Four Wheeler Support', 'Interior Sanitization', 24900, 18675, 13073, 70, 5602, 30)
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
  scanv_pct = EXCLUDED.scanv_pct;

INSERT INTO service_prices_public (service_id, price_paise, mrp_paise, updated_at)
SELECT service_id, new_amount_paise, GREATEST(current_amount_paise, ROUND(new_amount_paise / 0.75)::INTEGER), NOW()
FROM service_pricing
WHERE service_id IN ('tw-polish', 'fw-sanitize')
ON CONFLICT (service_id) DO UPDATE SET
  price_paise = EXCLUDED.price_paise,
  mrp_paise = EXCLUDED.mrp_paise,
  updated_at = EXCLUDED.updated_at;

UPDATE service_pricing SET
  sub_service_name = 'Mechanic · pick-up · wash · 7 services'
WHERE service_id = 'two-wheeler';

UPDATE service_pricing SET
  sub_service_name = 'Car service · pick-up · sanitization · 7 services'
WHERE service_id = 'four-wheeler';

INSERT INTO public.services (id, cat, name, description, icon, status, price)
SELECT
  sp.service_id,
  CASE WHEN sp.service_id LIKE 'tw-%' THEN 'Two Wheeler Support' ELSE 'Four Wheeler Support' END,
  sp.service_name,
  sp.sub_service_name,
  '🔧',
  'active',
  (sp.new_amount_paise::numeric / 100)
FROM public.service_pricing sp
WHERE sp.service_id IN ('tw-polish', 'fw-sanitize')
ON CONFLICT (id) DO UPDATE SET
  cat = EXCLUDED.cat,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price;
