-- Top Rated flag on pricing (1 = Top Rated page; 0 = discounted default)

ALTER TABLE service_pricing
  ADD COLUMN IF NOT EXISTS top_rated SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE service_prices_public
  ADD COLUMN IF NOT EXISTS top_rated SMALLINT NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION sync_public_prices()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO service_prices_public (service_id, price_paise, mrp_paise, top_rated, updated_at)
  VALUES (
    NEW.service_id,
    NEW.new_amount_paise,
    GREATEST(NEW.current_amount_paise, ROUND(NEW.new_amount_paise / 0.75)::INTEGER),
    COALESCE(NEW.top_rated, 0),
    NOW()
  )
  ON CONFLICT (service_id) DO UPDATE SET
    price_paise = EXCLUDED.price_paise,
    mrp_paise = EXCLUDED.mrp_paise,
    top_rated = EXCLUDED.top_rated,
    updated_at = EXCLUDED.updated_at;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

UPDATE service_prices_public p
SET top_rated = sp.top_rated
FROM service_pricing sp
WHERE p.service_id = sp.service_id;
