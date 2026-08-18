-- Beauty home card subtitle — inclusive makeup · salon · grooming copy
UPDATE service_pricing SET
  sub_service_name = 'Makeup · Salon · Grooming services',
  updated_at = NOW()
WHERE service_id = 'beauty';
