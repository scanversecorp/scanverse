-- Sample vendors for Beauty & Repairs sub-services (2 active partners each)

DO $$
DECLARE
  svc RECORD;
  suffix TEXT;
  vname TEXT;
  vphone TEXT;
  vid UUID;
  rn INT := 9000;
  lat_base CONSTANT DOUBLE PRECISION := 18.5204;
  lng_base CONSTANT DOUBLE PRECISION := 73.8567;
BEGIN
  FOR svc IN
    SELECT
      sp.service_id,
      COALESCE(sp.parent_id, sp.service_id) AS category_id
    FROM service_pricing sp
    WHERE sp.is_category IS NOT TRUE
      AND (sp.service_id LIKE 'bt-%' OR sp.service_id LIKE 'rp-%')
    ORDER BY sp.sort_order NULLS LAST, sp.service_id
  LOOP
    rn := rn + 1;

    FOREACH suffix IN ARRAY ARRAY['A', 'B']
    LOOP
      vname := 'Sample_' || svc.service_id || '_Vendor_' || suffix;
      vphone := '9' || lpad(
        (rn * 2 - CASE WHEN suffix = 'A' THEN 1 ELSE 0 END)::text,
        9,
        '0'
      );

      SELECT id INTO vid
      FROM vendor_partners
      WHERE business_name = vname
      LIMIT 1;

      IF vid IS NULL THEN
        INSERT INTO vendor_partners (
          business_name,
          contact_name,
          phone,
          phone_verified,
          shop_or_flat,
          street_name,
          city,
          pincode,
          state,
          country,
          country_code,
          address_lat,
          address_lng,
          gps_lat,
          gps_lng,
          status,
          onboarded_at,
          notes
        ) VALUES (
          vname,
          'Sample Contact ' || suffix,
          vphone,
          true,
          'Sample Office',
          'Sample Street',
          'Pune',
          '411057',
          'Maharashtra',
          'India',
          'IN',
          lat_base + ((rn % 20) * 0.0005) + (CASE WHEN suffix = 'B' THEN 0.0002 ELSE 0 END),
          lng_base + ((rn % 20) * 0.0005) + (CASE WHEN suffix = 'B' THEN 0.0002 ELSE 0 END),
          lat_base + ((rn % 20) * 0.0005) + (CASE WHEN suffix = 'B' THEN 0.0002 ELSE 0 END),
          lng_base + ((rn % 20) * 0.0005) + (CASE WHEN suffix = 'B' THEN 0.0002 ELSE 0 END),
          'active',
          now(),
          'sample_vendor_seed_beauty_repairs · auto-seeded for dispatch testing'
        )
        RETURNING id INTO vid;
      ELSE
        UPDATE vendor_partners SET status = 'active', phone_verified = true WHERE id = vid;
      END IF;

      INSERT INTO vendor_partner_services (vendor_id, service_id, category_id, is_active)
      VALUES (vid, svc.service_id, svc.category_id, true)
      ON CONFLICT (vendor_id, service_id) DO UPDATE SET is_active = true, category_id = EXCLUDED.category_id;
    END LOOP;
  END LOOP;
END $$;
