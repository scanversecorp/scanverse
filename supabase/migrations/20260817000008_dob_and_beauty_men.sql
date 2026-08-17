-- Date of birth on profiles + vendor partners; Beauty men's tab services

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;

ALTER TABLE public.vendor_partners
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;

COMMENT ON COLUMN public.profiles.date_of_birth IS 'Customer/partner date of birth — collected at enrollment';
COMMENT ON COLUMN public.vendor_partners.date_of_birth IS 'Partner date of birth — collected at vendor onboarding';

-- Men's grooming tab: move themes + add beard / men's facial
UPDATE service_pricing SET theme = 'men', sub_card = 'Men''s grooming', updated_at = NOW()
WHERE service_id IN ('bt-haircut-men', 'bt-massage');

INSERT INTO service_pricing (
  service_id, card, sub_card, service_name, sub_service_name,
  current_amount_paise, new_amount_paise,
  partner_amount_paise, partner_pct, scanv_amount_paise, scanv_pct,
  parent_id, is_category, theme, unit, icon, sort_order, active, service_status
) VALUES
  ('bt-beard-grooming', 'Beauty & Personal Care', 'Men''s grooming', 'Beard Trim & Shave', 'Beard shape · trim · shave · 20 min', 39900, 29925, 20948, 70, 8977, 30, 'beauty', false, 'men', 'visit', '🧔', 73, true, 'active'),
  ('bt-mens-facial', 'Beauty & Personal Care', 'Men''s grooming', 'Men''s Facial & Cleanup', 'Deep cleanse · de-tan · 45 min', 59900, 44925, 31448, 70, 13477, 30, 'beauty', false, 'men', 'visit', '🧖‍♂️', 74, true, 'active')
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

UPDATE service_pricing SET
  sub_service_name = 'Salon · men''s grooming · makeup · 10 services',
  sort_order = 70
WHERE service_id = 'beauty';

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
WHERE s.id IN ('bt-beard-grooming', 'bt-mens-facial')
ON CONFLICT (service_id) DO NOTHING;

-- Sample vendors for new men's grooming services
DO $$
DECLARE
  svc RECORD;
  suffix TEXT;
  vname TEXT;
  vphone TEXT;
  vid UUID;
  rn INT := 9100;
  lat_base CONSTANT DOUBLE PRECISION := 18.5204;
  lng_base CONSTANT DOUBLE PRECISION := 73.8567;
BEGIN
  FOR svc IN
    SELECT sp.service_id, COALESCE(sp.parent_id, sp.service_id) AS category_id
    FROM service_pricing sp
    WHERE sp.service_id IN ('bt-beard-grooming', 'bt-mens-facial')
  LOOP
    rn := rn + 1;
    FOREACH suffix IN ARRAY ARRAY['A', 'B']
    LOOP
      vname := 'Sample_' || svc.service_id || '_Vendor_' || suffix;
      vphone := '9' || lpad((rn * 2 - CASE WHEN suffix = 'A' THEN 1 ELSE 0 END)::text, 9, '0');
      SELECT id INTO vid FROM vendor_partners WHERE business_name = vname LIMIT 1;
      IF vid IS NULL THEN
        INSERT INTO vendor_partners (
          business_name, contact_name, phone, phone_verified,
          shop_or_flat, street_name, city, pincode, state, country, country_code,
          address_lat, address_lng, gps_lat, gps_lng, status, onboarded_at, notes
        ) VALUES (
          vname, 'Sample Contact ' || suffix, vphone, true,
          'Sample Office', 'Sample Street', 'Pune', '411057', 'Maharashtra', 'India', 'IN',
          lat_base + ((rn % 20) * 0.0005), lng_base + ((rn % 20) * 0.0005),
          lat_base + ((rn % 20) * 0.0005), lng_base + ((rn % 20) * 0.0005),
          'active', now(), 'sample_vendor_seed_beauty_men'
        ) RETURNING id INTO vid;
      END IF;
      INSERT INTO vendor_partner_services (vendor_id, service_id, category_id, is_active)
      VALUES (vid, svc.service_id, svc.category_id, true)
      ON CONFLICT (vendor_id, service_id) DO UPDATE SET is_active = true;
    END LOOP;
  END LOOP;
END $$;
