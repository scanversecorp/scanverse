-- Move Head Massage (Champi) back to Salon at home (was incorrectly under Men's grooming)

UPDATE service_pricing SET
  theme = 'salon',
  sub_card = 'Salon at home',
  updated_at = NOW()
WHERE service_id = 'bt-massage';
