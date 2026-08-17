-- Rename food home card: drop "& Bars"

UPDATE service_pricing
SET card = 'Food & Restaurants',
    service_name = 'Food & Restaurants'
WHERE service_id = 'food' AND is_category = TRUE;

UPDATE service_pricing
SET card = 'Food & Restaurants'
WHERE parent_id = 'food' AND card = 'Food & Restaurants & Bars';

UPDATE public.services
SET cat = 'Food & Restaurants',
    name = 'Food & Restaurants'
WHERE id = 'food';

UPDATE public.services
SET cat = 'Food & Restaurants'
WHERE cat = 'Food & Restaurants & Bars';
