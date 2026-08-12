-- bookings.service_id FK references public.services(id). The legacy services table was empty,
-- so recovery inserts failed with bookings_service_id_fkey. Seed from service_pricing catalog.

ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_cat_check;

INSERT INTO public.services (id, cat, name, description, icon, status, price)
SELECT
  sp.service_id,
  CASE
    WHEN sp.service_id IN ('legal','cloud','vip','health','property','household','delivery','food','two-wheeler','four-wheeler')
      THEN CASE sp.service_id
        WHEN 'legal' THEN 'Legal'
        WHEN 'cloud' THEN 'Cloud Services'
        WHEN 'vip' THEN 'VIP Appointments'
        WHEN 'health' THEN 'Health Care'
        WHEN 'property' THEN 'Property & Rentals'
        WHEN 'household' THEN 'Household Services'
        WHEN 'delivery' THEN 'Deliveries'
        WHEN 'food' THEN 'Food'
        WHEN 'two-wheeler' THEN 'Two Wheeler Support'
        WHEN 'four-wheeler' THEN 'Four Wheeler Support'
      END
    WHEN sp.service_id LIKE 'lg-%' THEN 'Legal'
    WHEN sp.service_id LIKE 'cl-%' THEN 'Cloud Services'
    WHEN sp.service_id LIKE 'vip-%' THEN 'VIP Appointments'
    WHEN sp.service_id LIKE 'hl-%' THEN 'Health Care'
    WHEN sp.service_id LIKE 'pr-%' THEN 'Property & Rentals'
    WHEN sp.service_id LIKE 'hh-%' THEN 'Household Services'
    WHEN sp.service_id LIKE 'dl-%' THEN 'Deliveries'
    WHEN sp.service_id LIKE 'fd-%' THEN 'Food'
    WHEN sp.service_id LIKE 'tw-%' THEN 'Two Wheeler Support'
    WHEN sp.service_id LIKE 'fw-%' THEN 'Four Wheeler Support'
    ELSE sp.card
  END AS cat,
  sp.service_name,
  COALESCE(NULLIF(TRIM(sp.sub_service_name), ''), sp.card),
  '🔧',
  'active',
  (sp.new_amount_paise::numeric / 100)
FROM public.service_pricing sp
ON CONFLICT (id) DO UPDATE SET
  cat = EXCLUDED.cat,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  status = EXCLUDED.status,
  price = EXCLUDED.price;

COMMENT ON TABLE public.services IS 'Legacy FK target for bookings.service_id; seeded from service_pricing catalog';

-- Recover paid intent TXN-1786499737587 (Same-Day Courier, 9638 paise) — metadata was null at payment time.
UPDATE public.payment_intents
SET
  service_id = 'dl-sameday',
  service_name = 'Same-Day Courier'
WHERE txn_id = 'TXN-1786499737587'
  AND status = 'paid'
  AND (service_id IS NULL OR service_name IS NULL);
