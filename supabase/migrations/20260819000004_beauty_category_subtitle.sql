-- Beauty category subtitle under heading (not on home card)
UPDATE service_pricing SET
  sub_service_name = 'Beauty · Makeup · Salon · Services · 25% off',
  updated_at = NOW()
WHERE service_id = 'beauty';
