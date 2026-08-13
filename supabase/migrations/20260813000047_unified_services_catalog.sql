-- Unified services catalog: pricing admin is single source of truth for names + prices.
-- service_pricing (admin) → trigger → service_prices_public (anon read) + services (bookings FK).

ALTER TABLE service_pricing
  ADD COLUMN IF NOT EXISTS parent_id TEXT,
  ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'visit',
  ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT '✨',
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS service_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS is_category BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE service_pricing
  DROP CONSTRAINT IF EXISTS service_pricing_service_status_check;
ALTER TABLE service_pricing
  ADD CONSTRAINT service_pricing_service_status_check
  CHECK (service_status IN ('active', 'inactive', 'paused'));

ALTER TABLE service_prices_public
  ADD COLUMN IF NOT EXISTS parent_id TEXT,
  ADD COLUMN IF NOT EXISTS card TEXT,
  ADD COLUMN IF NOT EXISTS sub_card TEXT,
  ADD COLUMN IF NOT EXISTS service_name TEXT,
  ADD COLUMN IF NOT EXISTS sub_service_name TEXT,
  ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'visit',
  ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT '✨',
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS service_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS is_category BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE service_prices_public
  DROP CONSTRAINT IF EXISTS service_prices_public_service_status_check;
ALTER TABLE service_prices_public
  ADD CONSTRAINT service_prices_public_service_status_check
  CHECK (service_status IN ('active', 'inactive', 'paused'));

UPDATE service_pricing SET service_status = CASE WHEN active = FALSE THEN 'inactive' ELSE 'active' END
WHERE service_status IS NULL OR service_status = 'active' AND active = FALSE;

-- Backfill parent_id + is_category for existing rows
UPDATE service_pricing SET is_category = TRUE, parent_id = NULL
WHERE service_id IN ('legal','cloud','vip','health','property','household','delivery','food','two-wheeler','four-wheeler');

UPDATE service_pricing SET parent_id = 'household', is_category = FALSE WHERE service_id LIKE 'hh-%';
UPDATE service_pricing SET parent_id = 'cloud', is_category = FALSE WHERE service_id LIKE 'cl-%';
UPDATE service_pricing SET parent_id = 'legal', is_category = FALSE WHERE service_id LIKE 'lg-%';
UPDATE service_pricing SET parent_id = 'vip', is_category = FALSE WHERE service_id LIKE 'vip-%' AND service_id <> 'vip';
UPDATE service_pricing SET parent_id = 'health', is_category = FALSE WHERE service_id LIKE 'hl-%';
UPDATE service_pricing SET parent_id = 'property', is_category = FALSE WHERE service_id LIKE 'pr-%';
UPDATE service_pricing SET parent_id = 'delivery', is_category = FALSE WHERE service_id LIKE 'dl-%';
UPDATE service_pricing SET parent_id = 'food', is_category = FALSE WHERE service_id LIKE 'fd-%';
UPDATE service_pricing SET parent_id = 'two-wheeler', is_category = FALSE WHERE service_id LIKE 'tw-%';
UPDATE service_pricing SET parent_id = 'four-wheeler', is_category = FALSE WHERE service_id LIKE 'fw-%';

CREATE OR REPLACE FUNCTION sync_public_prices()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO service_prices_public (
    service_id, price_paise, mrp_paise, top_rated, updated_at,
    parent_id, card, sub_card, service_name, sub_service_name,
    theme, unit, icon, sort_order, active, service_status, is_category
  )
  VALUES (
    NEW.service_id,
    NEW.new_amount_paise,
    GREATEST(NEW.current_amount_paise, ROUND(NEW.new_amount_paise / 0.75)::INTEGER),
    COALESCE(NEW.top_rated, 0),
    NOW(),
    NEW.parent_id,
    NEW.card,
    NEW.sub_card,
    NEW.service_name,
    NEW.sub_service_name,
    COALESCE(NEW.theme, 'default'),
    COALESCE(NEW.unit, 'visit'),
    COALESCE(NEW.icon, '✨'),
    COALESCE(NEW.sort_order, 0),
    COALESCE(NEW.service_status, 'active') = 'active',
    COALESCE(NEW.service_status, CASE WHEN COALESCE(NEW.active, TRUE) THEN 'active' ELSE 'inactive' END),
    COALESCE(NEW.is_category, FALSE)
  )
  ON CONFLICT (service_id) DO UPDATE SET
    price_paise = EXCLUDED.price_paise,
    mrp_paise = EXCLUDED.mrp_paise,
    top_rated = EXCLUDED.top_rated,
    updated_at = EXCLUDED.updated_at,
    parent_id = EXCLUDED.parent_id,
    card = EXCLUDED.card,
    sub_card = EXCLUDED.sub_card,
    service_name = EXCLUDED.service_name,
    sub_service_name = EXCLUDED.sub_service_name,
    theme = EXCLUDED.theme,
    unit = EXCLUDED.unit,
    icon = EXCLUDED.icon,
    sort_order = EXCLUDED.sort_order,
    active = EXCLUDED.active,
    service_status = EXCLUDED.service_status,
    is_category = EXCLUDED.is_category;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-sync all public rows with new columns
UPDATE service_pricing SET updated_at = NOW();

CREATE OR REPLACE FUNCTION sync_services_from_pricing()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.services (id, cat, name, description, icon, status, price)
  VALUES (
    NEW.service_id,
    NEW.card,
    NEW.service_name,
    COALESCE(NULLIF(TRIM(NEW.sub_service_name), ''), NEW.card),
    COALESCE(NEW.icon, '🔧'),
    COALESCE(NEW.service_status, CASE WHEN COALESCE(NEW.active, TRUE) THEN 'active' ELSE 'inactive' END),
    NEW.new_amount_paise::numeric / 100
  )
  ON CONFLICT (id) DO UPDATE SET
    cat = EXCLUDED.cat,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    status = EXCLUDED.status,
    price = EXCLUDED.price;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_services_from_pricing ON service_pricing;
CREATE TRIGGER trg_sync_services_from_pricing
  AFTER INSERT OR UPDATE ON service_pricing
  FOR EACH ROW EXECUTE FUNCTION sync_services_from_pricing();

COMMENT ON COLUMN service_pricing.parent_id IS 'Category id (legal, household, …) for sub-services; NULL for top-level category rows';
COMMENT ON COLUMN service_pricing.is_category IS 'TRUE for home/pricing category cards (legal, cloud, …)';
