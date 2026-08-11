-- Enable live price push to open app tabs + seed missing vehicle parent cards

INSERT INTO service_pricing (
  service_id, card, sub_card, service_name, sub_service_name,
  current_amount_paise, new_amount_paise,
  partner_amount_paise, partner_pct, scanv_amount_paise, scanv_pct
) VALUES
  ('two-wheeler', 'Two Wheeler Support', '—', 'Two Wheeler Support', 'Mechanic · pick-up · wash · 6 services', 29900, 22425, 15698, 70, 6727, 30),
  ('four-wheeler', 'Four Wheeler Support', '—', 'Four Wheeler Support', 'Car service · pick-up · detailing · 6 services', 49900, 37425, 26198, 70, 11227, 30)
ON CONFLICT (service_id) DO NOTHING;

INSERT INTO service_prices_public (service_id, price_paise, mrp_paise, updated_at)
SELECT service_id, new_amount_paise, GREATEST(current_amount_paise, ROUND(new_amount_paise / 0.75)::INTEGER), NOW()
FROM service_pricing
WHERE service_id IN ('two-wheeler', 'four-wheeler')
ON CONFLICT (service_id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE service_prices_public;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
