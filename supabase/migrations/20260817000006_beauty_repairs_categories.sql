-- Beauty & Personal Care + Repairs & Handyman — 12-card home grid (2 parents + 16 subs)

INSERT INTO service_pricing (
  service_id, card, sub_card, service_name, sub_service_name,
  current_amount_paise, new_amount_paise,
  partner_amount_paise, partner_pct, scanv_amount_paise, scanv_pct,
  parent_id, is_category, theme, unit, icon, sort_order, active, service_status
) VALUES
  ('beauty', 'Beauty & Personal Care', '—', 'Beauty & Personal Care', 'Salon · grooming · makeup · 8 services', 19900, 14925, 10448, 70, 4477, 30, NULL, true, 'default', 'visit', '💄', 70, true, 'active'),
  ('repairs', 'Repairs & Handyman', '—', 'Repairs & Handyman', 'Electric · plumbing · AC · 8 services', 29900, 22425, 15698, 70, 6727, 30, NULL, true, 'default', 'visit', '🔧', 90, true, 'active'),
  ('bt-haircut-women', 'Beauty & Personal Care', 'Salon at home', 'Women''s Haircut & Styling', 'Cut · blow-dry · basic styling · 45–60 min', 79900, 59925, 41948, 70, 17977, 30, 'beauty', false, 'salon', 'visit', '💇‍♀️', 71, true, 'active'),
  ('bt-haircut-men', 'Beauty & Personal Care', 'Salon at home', 'Men''s Haircut & Beard', 'Haircut · beard trim · styling · 30 min', 49900, 37425, 26198, 70, 11227, 30, 'beauty', false, 'salon', 'visit', '💈', 72, true, 'active'),
  ('bt-threading', 'Beauty & Personal Care', 'Salon at home', 'Threading & Waxing', 'Eyebrow · upper lip · arms · hygienic', 39900, 29925, 20948, 70, 8977, 30, 'beauty', false, 'salon', 'visit', '✨', 73, true, 'active'),
  ('bt-mani-pedi', 'Beauty & Personal Care', 'Salon at home', 'Manicure & Pedicure', 'Cut · file · polish · foot soak · 60 min', 99900, 74925, 52448, 70, 22477, 30, 'beauty', false, 'salon', 'visit', '💅', 74, true, 'active'),
  ('bt-makeup', 'Beauty & Personal Care', 'Occasion & care', 'Party & Bridal Makeup', 'Party · engagement · bridal trial · premium', 149900, 112425, 78698, 70, 33727, 30, 'beauty', false, 'occasion', 'visit', '💄', 75, true, 'active'),
  ('bt-facial', 'Beauty & Personal Care', 'Occasion & care', 'Facial & Cleanup', 'Deep cleanse · glow · acne-safe · 45 min', 69900, 52425, 36698, 70, 15727, 30, 'beauty', false, 'occasion', 'visit', '🧖‍♀️', 76, true, 'active'),
  ('bt-massage', 'Beauty & Personal Care', 'Occasion & care', 'Head Massage (Champi)', 'Oil champi · stress relief · 30 min', 49900, 37425, 26198, 70, 11227, 30, 'beauty', false, 'occasion', 'visit', '💆', 77, true, 'active'),
  ('bt-mehendi', 'Beauty & Personal Care', 'Occasion & care', 'Mehendi at Home', 'Bridal · party · Arabic · cone art', 89900, 67425, 47198, 70, 20227, 30, 'beauty', false, 'occasion', 'visit', '🌸', 78, true, 'active'),
  ('rp-electrician', 'Repairs & Handyman', 'Fix it', 'Electrician Visit', 'Switch · fan · wiring · fuse · 60 min', 39900, 29925, 20948, 70, 8977, 30, 'repairs', false, 'fix', 'visit', '⚡', 91, true, 'active'),
  ('rp-plumber', 'Repairs & Handyman', 'Fix it', 'Plumber Visit', 'Tap · leak · blockage · flush · 60 min', 39900, 29925, 20948, 70, 8977, 30, 'repairs', false, 'fix', 'visit', '🔧', 92, true, 'active'),
  ('rp-carpenter', 'Repairs & Handyman', 'Fix it', 'Carpenter Visit', 'Door · lock · hinge · furniture · hourly', 49900, 37425, 26198, 70, 11227, 30, 'repairs', false, 'fix', 'visit', '🪚', 93, true, 'active'),
  ('rp-ac', 'Repairs & Handyman', 'Fix it', 'AC Service & Gas Refill', 'Split AC · deep clean · gas check · seasonal', 99900, 74925, 52448, 70, 22477, 30, 'repairs', false, 'fix', 'visit', '❄️', 94, true, 'active'),
  ('rp-washing', 'Repairs & Handyman', 'Appliances', 'Washing Machine Repair', 'Front/top load · drum · motor · leak', 59900, 44925, 31448, 70, 13477, 30, 'repairs', false, 'appliances', 'visit', '🫧', 95, true, 'active'),
  ('rp-ro', 'Repairs & Handyman', 'Appliances', 'RO / Water Purifier Service', 'Filter change · SMPS · leak · TDS check', 49900, 37425, 26198, 70, 11227, 30, 'repairs', false, 'appliances', 'visit', '💧', 96, true, 'active'),
  ('rp-geyser', 'Repairs & Handyman', 'Appliances', 'Geyser Repair', 'Heating · thermostat · leak · 60 min', 49900, 37425, 26198, 70, 11227, 30, 'repairs', false, 'appliances', 'visit', '🔥', 97, true, 'active'),
  ('rp-appliance', 'Repairs & Handyman', 'Appliances', 'TV & Appliance Mount', 'TV bracket · microwave · chimney · install', 39900, 29925, 20948, 70, 8977, 30, 'repairs', false, 'appliances', 'visit', '📺', 98, true, 'active')
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

INSERT INTO public.service_schedules (service_id, parent_id, windows)
SELECT s.id,
  COALESCE(sp.parent_id, s.id),
  '[
    {"day":1,"start":"09:00","end":"19:00"},
    {"day":2,"start":"09:00","end":"19:00"},
    {"day":3,"start":"09:00","end":"19:00"},
    {"day":4,"start":"09:00","end":"19:00"},
    {"day":5,"start":"09:00","end":"19:00"},
    {"day":6,"start":"09:00","end":"19:00"}
  ]'::jsonb
FROM public.services s
LEFT JOIN public.service_pricing sp ON sp.service_id = s.id
WHERE s.id IN (
  'beauty', 'repairs',
  'bt-haircut-women', 'bt-haircut-men', 'bt-threading', 'bt-mani-pedi',
  'bt-makeup', 'bt-facial', 'bt-massage', 'bt-mehendi',
  'rp-electrician', 'rp-plumber', 'rp-carpenter', 'rp-ac',
  'rp-washing', 'rp-ro', 'rp-geyser', 'rp-appliance'
)
ON CONFLICT (service_id) DO NOTHING;

INSERT INTO scanv_card_business (card_id, label, icon, revenue_priority, target_active_vendors, go_live_phase, next_action, blocker) VALUES
  ('beauty', 'Beauty & Personal Care', '💄', 12, 6, 'recruiting', 'Onboard 3 salon-at-home partners in Wakad/PCMC', 'Need portfolio photos for sub-cards'),
  ('repairs', 'Repairs & Handyman', '🔧', 17, 8, 'recruiting', 'Electrician + plumber + AC tech per zone', 'Parts pricing SOP for quotes')
ON CONFLICT (card_id) DO UPDATE SET
  label = EXCLUDED.label,
  icon = EXCLUDED.icon,
  revenue_priority = EXCLUDED.revenue_priority,
  target_active_vendors = EXCLUDED.target_active_vendors,
  go_live_phase = EXCLUDED.go_live_phase,
  next_action = EXCLUDED.next_action,
  blocker = EXCLUDED.blocker,
  updated_at = NOW();
