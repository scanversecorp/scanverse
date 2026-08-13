-- Home card display names + Data Center spelling (admin + legacy services sync)

UPDATE service_pricing SET card = 'Legal & Consulting', service_name = 'Legal & Consulting'
WHERE service_id = 'legal' OR card = 'Legal services';

UPDATE service_pricing SET card = 'AI, Cloud & Data Center', service_name = 'AI, Cloud & Data Center',
  sub_service_name = 'AI · cloud · data center · 18 services'
WHERE service_id = 'cloud';

UPDATE service_pricing SET card = 'AI, Cloud & Data Center'
WHERE card = 'Cloud services';

UPDATE service_pricing SET service_name = 'Data Center Consulting'
WHERE service_id = 'cl-datacenter';

UPDATE service_pricing SET service_name = 'Data Center Build & Run'
WHERE service_id = 'cl-dc-operate';

UPDATE service_pricing SET card = 'VIP Concierge', service_name = 'VIP Concierge'
WHERE service_id = 'vip' OR card = 'VIP appointments';

UPDATE service_pricing SET card = 'Health at Home', service_name = 'Health at Home'
WHERE service_id = 'health' OR card = 'Health care';

UPDATE service_pricing SET card = 'Property & Rentals', service_name = 'Property & Rentals'
WHERE service_id = 'property' OR card = 'Property & rentals';

UPDATE service_pricing SET card = 'Cleaning & Home Help', service_name = 'Cleaning & Home Help'
WHERE service_id = 'household' OR card = 'Household services';

UPDATE service_pricing SET card = 'Courier & Deliveries', service_name = 'Courier & Deliveries'
WHERE service_id = 'delivery' OR card = 'Deliveries';

UPDATE service_pricing SET card = 'Food & Restaurants & Bars', service_name = 'Food & Restaurants & Bars',
  sub_service_name = 'Tiffin · restaurants · bars · 6 services'
WHERE service_id = 'food';

UPDATE service_pricing SET card = 'Food & Restaurants & Bars'
WHERE card = 'Food';

UPDATE service_pricing SET card = 'Bike Care', service_name = 'Bike Care'
WHERE service_id = 'two-wheeler' OR card IN ('Two Wheeler', 'Two Wheeler Support');

UPDATE service_pricing SET card = 'Car Care', service_name = 'Car Care'
WHERE service_id = 'four-wheeler' OR card IN ('Four Wheeler', 'Four Wheeler Support');

UPDATE public.services s
SET
  name = sp.service_name,
  description = COALESCE(NULLIF(TRIM(sp.sub_service_name), ''), sp.card)
FROM public.service_pricing sp
WHERE s.id = sp.service_id
  AND (
    s.name IS DISTINCT FROM sp.service_name
    OR s.description IS DISTINCT FROM COALESCE(NULLIF(TRIM(sp.sub_service_name), ''), sp.card)
  );
