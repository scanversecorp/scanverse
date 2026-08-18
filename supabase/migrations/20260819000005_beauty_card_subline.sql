-- Beauty home card + category subtitle with grooming
UPDATE service_pricing SET
  sub_service_name = 'Beauty · Grooming · Makeup · Salon · Services · 25% off',
  updated_at = NOW()
WHERE service_id = 'beauty';
