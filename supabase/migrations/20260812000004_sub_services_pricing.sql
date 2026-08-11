-- Seed pricing rows for Legal, VIP, Health, Property, Delivery, Food sub-services (32)

INSERT INTO service_pricing (
  service_id, card, sub_card, service_name, sub_service_name,
  current_amount_paise, new_amount_paise,
  partner_amount_paise, partner_pct, scanv_amount_paise, scanv_pct
) VALUES
  ('lg-consult', 'Legal services', 'Consultation & court', 'Lawyer Consultation', '30-min advice · civil · property · family', 74925, 74925, 52448, 70, 22477, 30),
  ('lg-court', 'Legal services', 'Consultation & court', 'Court Filing & Notices', 'Draft · file · track · represent', 2249925, 2249925, 1574948, 70, 674977, 30),
  ('lg-contract', 'Legal services', 'Consultation & court', 'Business Contract Review', 'Vendor · lease · employment · NDAs', 2999925, 2999925, 2099948, 70, 899977, 30),
  ('lg-doc-draft', 'Legal services', 'Documents & registration', 'Document Drafting', 'Agreements · wills · affidavits · deeds', 1499925, 1499925, 1049948, 70, 449977, 30),
  ('lg-property-reg', 'Legal services', 'Documents & registration', 'Property Registration', 'Sale deed · gift · lease · index II', 3749925, 3749925, 2624948, 70, 1124977, 30),
  ('lg-notary', 'Legal services', 'Documents & registration', 'Notary & Affidavit', 'Attestation · sworn statements · copies', 37425, 37425, 26198, 70, 11227, 30),
  ('vip-concierge', 'VIP appointments', 'Concierge & assistant', '24×7 Personal Concierge', 'Tasks · bookings · reminders · errands', 7499925, 7499925, 5249948, 70, 2249977, 30),
  ('vip-assistant', 'VIP appointments', 'Concierge & assistant', 'Executive Assistant', 'Calendar · calls · research · hourly', 37425, 37425, 26198, 70, 11227, 30),
  ('vip-priority', 'VIP appointments', 'Concierge & assistant', 'Priority Appointments', 'Doctors · lawyers · govt · fast-track', 74925, 74925, 52448, 70, 22477, 30),
  ('vip-airport', 'VIP appointments', 'Travel & events', 'Airport Transfer', 'Pickup · drop · meet & greet · Pune', 1124925, 1124925, 787448, 70, 337477, 30),
  ('vip-event', 'VIP appointments', 'Travel & events', 'Event Planning', 'Corporate · wedding · private · end-to-end', 3749925, 3749925, 2624948, 70, 1124977, 30),
  ('hl-doctor', 'Health care', 'Home care', 'Doctor at Home', 'GP visit · vitals · prescription · PCMC', 74925, 74925, 52448, 70, 22477, 30),
  ('hl-specialist', 'Health care', 'Home care', 'Specialist Consultation', 'Cardio · ortho · derma · paediatric', 1124925, 1124925, 787448, 70, 337477, 30),
  ('hl-elder', 'Health care', 'Home care', 'Elder Care Visit', 'Vitals · medication · mobility · hourly', 22425, 22425, 15698, 70, 6727, 30),
  ('hl-checkup', 'Health care', 'Tests & pharmacy', 'Full Body Checkup', '40+ tests · home sample · report', 1499925, 1499925, 1049948, 70, 449977, 30),
  ('hl-lab', 'Health care', 'Tests & pharmacy', 'Lab Tests at Home', 'Blood · urine · single or panel', 59925, 59925, 41948, 70, 17977, 30),
  ('hl-pharmacy', 'Health care', 'Tests & pharmacy', 'Pharmacy Delivery', 'Prescription · OTC · 60 min target', 37425, 37425, 26198, 70, 11227, 30),
  ('pr-buy', 'Property & rentals', 'Find property', 'Buy / Sell Assistance', 'Shortlist · negotiate · close · PCMC', 7499925, 7499925, 5249948, 70, 2249977, 30),
  ('pr-rent', 'Property & rentals', 'Find property', 'Rent & PG Finder', 'Flat · PG · coliving · tenant match', 37425, 37425, 26198, 70, 11227, 30),
  ('pr-site', 'Property & rentals', 'Find property', 'Site Visit Package', '3–5 properties · agent · same day', 1499925, 1499925, 1049948, 70, 449977, 30),
  ('pr-legal', 'Property & rentals', 'Verify & finance', 'Legal Verification', 'Title · encumbrance · approvals · report', 2249925, 2249925, 1574948, 70, 674977, 30),
  ('pr-loan', 'Property & rentals', 'Verify & finance', 'Home Loan Assistance', 'Compare banks · paperwork · faster sanction', 1499925, 1499925, 1049948, 70, 449977, 30),
  ('dl-sameday', 'Deliveries', 'Local delivery', 'Same-Day Courier', 'Pickup in 60 min · PCMC · Pune', 7425, 7425, 5198, 70, 2227, 30),
  ('dl-doc', 'Deliveries', 'Local delivery', 'Document Delivery', 'Legal · bank · office · confidential', 11175, 11175, 7823, 70, 3352, 30),
  ('dl-parcel', 'Deliveries', 'Local delivery', 'Parcel Pickup & Drop', 'Gifts · ecommerce · returns · multi-stop', 14925, 14925, 10448, 70, 4477, 30),
  ('dl-intercity', 'Deliveries', 'Express & bulk', 'Inter-City Express', 'Maharashtra · overnight · tracked', 37425, 37425, 26198, 70, 11227, 30),
  ('dl-bulk', 'Deliveries', 'Express & bulk', 'Business Bulk Delivery', 'Daily routes · SLAs · invoicing', 74925, 74925, 52448, 70, 22477, 30),
  ('fd-tiffin', 'Food', 'Daily meals', 'Home Tiffin Plan', 'Veg · non-veg · monthly · 2 meals', 4499925, 4499925, 3149948, 70, 1349977, 30),
  ('fd-restaurant', 'Food', 'Daily meals', 'Restaurant Order', 'Local restaurants · 30–60 min · track', 14925, 14925, 10448, 70, 4477, 30),
  ('fd-office', 'Food', 'Daily meals', 'Office Lunch Box', 'Team orders · invoicing · daily menu', 1124925, 1124925, 787448, 70, 337477, 30),
  ('fd-catering', 'Food', 'Catering & events', 'Party Catering', 'Birthday · corporate · 20–500 guests', 7499925, 7499925, 5249948, 70, 2249977, 30),
  ('fd-festival', 'Food', 'Catering & events', 'Festival Special Menu', 'Diwali · Ganesh · wedding sweets · bulk', 2249925, 2249925, 1574948, 70, 674977, 30)
ON CONFLICT (service_id) DO NOTHING;

INSERT INTO service_prices_public (service_id, price_paise, mrp_paise, updated_at)
SELECT service_id, new_amount_paise, GREATEST(current_amount_paise, ROUND(new_amount_paise / 0.75)::INTEGER), NOW()
FROM service_pricing
WHERE service_id LIKE 'lg-%' OR service_id LIKE 'vip-%' OR service_id LIKE 'hl-%'
  OR service_id LIKE 'pr-%' OR service_id LIKE 'dl-%' OR service_id LIKE 'fd-%'
ON CONFLICT (service_id) DO NOTHING;
