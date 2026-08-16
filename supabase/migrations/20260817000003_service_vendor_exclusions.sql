-- Per-service vendor dispatch exclusions (admin unchecks vendor → no bookings for that service).

CREATE TABLE IF NOT EXISTS public.service_vendor_exclusions (
  service_id TEXT NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendor_partners(id) ON DELETE CASCADE,
  reason TEXT,
  excluded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (service_id, vendor_id)
);

COMMENT ON TABLE public.service_vendor_exclusions IS 'Vendors excluded from dispatch for a specific service (schedule still applies to checked vendors)';

CREATE INDEX IF NOT EXISTS idx_service_vendor_exclusions_vendor
  ON public.service_vendor_exclusions(vendor_id);

ALTER TABLE public.service_vendor_exclusions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_vendor_exclusions_service_role ON public.service_vendor_exclusions;
CREATE POLICY service_vendor_exclusions_service_role ON public.service_vendor_exclusions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Exclude blocked vendors from nearest-vendor dispatch RPC
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
    haversine_km(
      p_lat, p_lng,
      COALESCE(vp.address_lat, vp.gps_lat),
      COALESCE(vp.address_lng, vp.gps_lng)
    ) AS distance_km
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
    AND NOT EXISTS (
      SELECT 1 FROM service_vendor_exclusions sve
      WHERE sve.vendor_id = vp.id AND sve.service_id = p_service_id
    )
    AND COALESCE(vp.address_lat, vp.gps_lat) IS NOT NULL
    AND COALESCE(vp.address_lng, vp.gps_lng) IS NOT NULL
    AND haversine_km(
      p_lat, p_lng,
      COALESCE(vp.address_lat, vp.gps_lat),
      COALESCE(vp.address_lng, vp.gps_lng)
    ) <= p_max_km
  ORDER BY distance_km ASC
  LIMIT p_limit;
$$ LANGUAGE SQL STABLE;
