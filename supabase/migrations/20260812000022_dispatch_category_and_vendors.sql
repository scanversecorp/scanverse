-- ScanV: dispatch category matching + broader vendor service lookup

ALTER TABLE booking_dispatch
  ADD COLUMN IF NOT EXISTS category_id TEXT;

CREATE OR REPLACE FUNCTION find_nearest_vendors(
  p_service_id TEXT,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_limit INT DEFAULT 3,
  p_max_km DOUBLE PRECISION DEFAULT 100,
  p_category_id TEXT DEFAULT NULL
) RETURNS TABLE (
  vendor_id UUID,
  business_name TEXT,
  phone TEXT,
  distance_km DOUBLE PRECISION
) AS $$
  SELECT
    vp.id,
    vp.business_name,
    vp.phone,
    haversine_km(p_lat, p_lng, vp.address_lat, vp.address_lng) AS distance_km
  FROM vendor_partners vp
  JOIN vendor_partner_services vps ON vps.vendor_id = vp.id
  WHERE vp.status = 'active'
    AND vps.is_active = TRUE
    AND (
      vps.service_id = p_service_id
      OR vps.category_id = p_service_id
      OR (p_category_id IS NOT NULL AND p_category_id <> '' AND vps.category_id = p_category_id)
      OR (p_category_id IS NOT NULL AND p_category_id <> '' AND vps.service_id = p_category_id)
    )
    AND vp.address_lat IS NOT NULL
    AND vp.address_lng IS NOT NULL
    AND haversine_km(p_lat, p_lng, vp.address_lat, vp.address_lng) <= p_max_km
  ORDER BY distance_km ASC
  LIMIT p_limit;
$$ LANGUAGE SQL STABLE;
