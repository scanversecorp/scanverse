-- Fill 2-column grid gaps — 10 additional sub-services (even count per theme group)

INSERT INTO service_pricing (
  service_id, card, sub_card, service_name, sub_service_name,
  current_amount_paise, new_amount_paise,
  partner_amount_paise, partner_pct, scanv_amount_paise, scanv_pct
) VALUES
  ('hh-sofa-clean', 'Household services', 'Deep cleaning', 'Sofa & Upholstery Clean', 'Fabric · cushions · stain treatment · 1–2 hrs', 18675, 18675, 13073, 70, 5602, 30),
  ('hh-ironing', 'Household services', 'Home help', 'Ironing & Pressing', 'Shirts · sarees · formals · hourly', 11175, 11175, 7823, 70, 3352, 30),
  ('lg-family', 'Legal services', 'Consultation & court', 'Family & Divorce Consult', 'Marriage · custody · maintenance · mediation', 112425, 112425, 78698, 70, 33727, 30),
  ('lg-rental', 'Legal services', 'Documents & registration', 'Rental Agreement Pack', 'Draft · stamp · registration guidance · 11-month', 74925, 74925, 52448, 70, 22477, 30),
  ('vip-dining', 'VIP appointments', 'Concierge & assistant', 'Premium Dining Reservations', 'Top restaurants · private tables · occasions', 37425, 37425, 26198, 70, 11227, 30),
  ('hl-nursing', 'Health care', 'Home care', 'Nursing Care at Home', 'Post-op · injections · wound dressings', 37425, 37425, 26198, 70, 11227, 30),
  ('hl-vaccine', 'Health care', 'Tests & pharmacy', 'Vaccination at Home', 'Flu · hepatitis · travel · corporate camps', 74925, 74925, 52448, 70, 22477, 30),
  ('pr-commercial', 'Property & rentals', 'Find property', 'Commercial Space Finder', 'Office · shop · warehouse · PCMC', 2249925, 2249925, 1574948, 70, 674977, 30),
  ('dl-grocery', 'Deliveries', 'Local delivery', 'Grocery & Essentials Run', 'Kirana · milk · bread · 90 min target', 11175, 11175, 7823, 70, 3352, 30),
  ('fd-breakfast', 'Food', 'Daily meals', 'Breakfast & Snacks Plan', 'Morning tiffin · poha · idli · monthly', 2624925, 2624925, 1837448, 70, 787477, 30)
ON CONFLICT (service_id) DO NOTHING;

INSERT INTO service_prices_public (service_id, price_paise, mrp_paise, updated_at)
SELECT service_id, new_amount_paise, GREATEST(current_amount_paise, ROUND(new_amount_paise / 0.75)::INTEGER), NOW()
FROM service_pricing
WHERE service_id IN ('hh-sofa-clean','hh-ironing','lg-family','lg-rental','vip-dining','hl-nursing','hl-vaccine','pr-commercial','dl-grocery','fd-breakfast')
ON CONFLICT (service_id) DO NOTHING;
