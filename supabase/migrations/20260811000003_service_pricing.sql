-- ScanV confidential service pricing (admin) + public live prices (app cards)

CREATE TABLE IF NOT EXISTS service_pricing (
  service_id TEXT PRIMARY KEY,
  card TEXT NOT NULL,
  sub_card TEXT NOT NULL DEFAULT '—',
  service_name TEXT NOT NULL,
  sub_service_name TEXT,
  current_amount_paise INTEGER NOT NULL,
  new_amount_paise INTEGER NOT NULL,
  partner_amount_paise INTEGER NOT NULL DEFAULT 0,
  partner_pct NUMERIC(5,2) NOT NULL DEFAULT 70.00,
  scanv_amount_paise INTEGER NOT NULL DEFAULT 0,
  scanv_pct NUMERIC(5,2) NOT NULL DEFAULT 30.00,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS service_prices_public (
  service_id TEXT PRIMARY KEY,
  price_paise INTEGER NOT NULL,
  mrp_paise INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION sync_public_prices()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO service_prices_public (service_id, price_paise, mrp_paise, updated_at)
  VALUES (
    NEW.service_id,
    NEW.new_amount_paise,
    GREATEST(NEW.current_amount_paise, ROUND(NEW.new_amount_paise / 0.75)::INTEGER),
    NOW()
  )
  ON CONFLICT (service_id) DO UPDATE SET
    price_paise = EXCLUDED.price_paise,
    mrp_paise = EXCLUDED.mrp_paise,
    updated_at = EXCLUDED.updated_at;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_public_prices ON service_pricing;
CREATE TRIGGER trg_sync_public_prices
  AFTER INSERT OR UPDATE ON service_pricing
  FOR EACH ROW EXECUTE FUNCTION sync_public_prices();

ALTER TABLE service_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_prices_public ENABLE ROW LEVEL SECURITY;

-- Public app: read live customer prices only (no partner/vendor splits)
CREATE POLICY service_prices_public_select ON service_prices_public
  FOR SELECT TO anon, authenticated USING (true);

-- Full pricing table: no client policies (edge function uses service role)

-- Seed all 38 ScanV offerings (current = new at launch; partner 70% / ScanV 30%)
INSERT INTO service_pricing (
  service_id, card, sub_card, service_name, sub_service_name,
  current_amount_paise, new_amount_paise,
  partner_amount_paise, partner_pct, scanv_amount_paise, scanv_pct
) VALUES
  ('legal', 'Legal services', '—', 'Legal services', 'Lawyers · docs · filings', 74925, 74925, 52448, 70, 22477, 30),
  ('cloud', 'Cloud services', '—', 'Cloud services', 'Hosting · infra · packages · 18 services', 374925, 374925, 262448, 70, 112477, 30),
  ('vip', 'VIP appointments', '—', 'VIP appointments', 'Priority · concierge · executive', 749925, 749925, 524948, 70, 224977, 30),
  ('health', 'Health care', '—', 'Health care', 'Doctors · tests · pharmacy', 37425, 37425, 26198, 70, 11227, 30),
  ('property', 'Property & rentals', '—', 'Property & rentals', 'Buy · sell · PG · flat · plots', 149925, 149925, 104948, 70, 44977, 30),
  ('household', 'Household services', '—', 'Household services', 'Deep clean · home help · 12 services', 11175, 11175, 7823, 70, 3352, 30),
  ('delivery', 'Deliveries', '—', 'Deliveries', 'Courier · parcels · documents', 7425, 7425, 5198, 70, 2227, 30),
  ('food', 'Food', '—', 'Food', 'Restaurants · tiffin · catering', 14925, 14925, 10448, 70, 4477, 30),
  ('hh-bathroom-deep', 'Household services', 'Deep cleaning', 'Bathroom Deep Clean', 'Deep scrub · sanitise · 45–60 min', 37425, 37425, 26198, 70, 11227, 30),
  ('hh-kitchen-deep', 'Household services', 'Deep cleaning', 'Kitchen Deep Clean', 'Counters · chimney · floor · grease', 44925, 44925, 31448, 70, 13477, 30),
  ('hh-flat-clean', 'Household services', 'Deep cleaning', 'Full Flat Cleaning', 'Complete home · 1–3 BHK · 3–5 hrs', 149925, 149925, 104948, 70, 44977, 30),
  ('hh-care-plan', 'Household services', 'Deep cleaning', 'Bathroom Care Plan', 'Weekly / fortnightly · fixed slot', 112425, 112425, 78698, 70, 33727, 30),
  ('hh-quick-clean', 'Household services', 'Deep cleaning', 'Quick Clean', 'Single task · bathroom · fan · 30 min', 11175, 11175, 7823, 70, 3352, 30),
  ('hh-house-help', 'Household services', 'Home help', 'House Help', 'Sweep · mop · dust · multi-task · hourly', 13650, 13650, 9555, 70, 4095, 30),
  ('hh-dishwashing', 'Household services', 'Home help', 'Dishwashing', 'Utensils · sink · platform wipe', 7425, 7425, 5198, 70, 2227, 30),
  ('hh-kitchen-help', 'Household services', 'Home help', 'Kitchen Tidy-Up', 'Platform · tiles · chimney wipe', 11175, 11175, 7823, 70, 3352, 30),
  ('hh-fan-clean', 'Household services', 'Home help', 'Fan Cleaning', 'Ceiling fan · blades · reachable only', 11175, 11175, 7823, 70, 3352, 30),
  ('hh-window-clean', 'Household services', 'Home help', 'Window Cleaning', 'Glass · frames · inside only', 14925, 14925, 10448, 70, 4477, 30),
  ('hh-laundry', 'Household services', 'Home help', 'Laundry Help', 'Fold · sort · organise wardrobe', 11175, 11175, 7823, 70, 3352, 30),
  ('hh-bathroom-help', 'Household services', 'Home help', 'Bathroom Refresh', 'WC · floor · taps · hourly', 14925, 14925, 10448, 70, 4477, 30),
  ('cl-iaas', 'Cloud services', 'Cloud hosting', 'Cloud Compute (IaaS)', 'Virtual servers · storage · scale on demand', 749925, 749925, 524948, 70, 224977, 30),
  ('cl-paas', 'Cloud services', 'Cloud hosting', 'App Platform (PaaS)', 'Deploy apps · skip server management', 599925, 599925, 419948, 70, 179977, 30),
  ('cl-saas', 'Cloud services', 'Cloud hosting', 'Business Apps (SaaS)', 'Ready software · subscribe & go', 374925, 374925, 262448, 70, 112477, 30),
  ('cl-hybrid', 'Cloud services', 'Cloud hosting', 'Hybrid Cloud Setup', 'On-prem + cloud · unified control', 1124925, 1124925, 787448, 70, 337477, 30),
  ('cl-datacenter', 'Cloud services', 'Infrastructure', 'Datacenter Consulting', 'Design · build · optimise facilities', 3749925, 3749925, 2624948, 70, 1124977, 30),
  ('cl-network', 'Cloud services', 'Infrastructure', 'Enterprise Networking', 'LAN · WAN · secure connectivity', 2249925, 2249925, 1574948, 70, 674977, 30),
  ('cl-hardware', 'Cloud services', 'Infrastructure', 'IT Hardware Supply', 'Servers · storage · laptops · networking', 1499925, 1499925, 1049948, 70, 449977, 30),
  ('cl-infra-audit', 'Cloud services', 'Infrastructure', 'Infrastructure Audit & Roadmap', 'Assess · benchmark · 12-month upgrade plan', 674925, 674925, 472448, 70, 202477, 30),
  ('cl-managed', 'Cloud services', 'Managed & media', 'Managed IT Services', '24×7 monitoring · IAM · proactive ops', 187425, 187425, 131198, 70, 56227, 30),
  ('cl-backup', 'Cloud services', 'Managed & media', 'Backup & Disaster Recovery', 'Snapshots · replication · restore drills', 112425, 112425, 78698, 70, 33727, 30),
  ('cl-video', 'Cloud services', 'Managed & media', 'Video & Streaming Platform', 'Secure delivery · education · media', 299925, 299925, 209948, 70, 89977, 30),
  ('cl-training', 'Cloud services', 'Managed & media', 'Cloud & IT Training', 'Hands-on labs · certs · career tracks', 374925, 374925, 262448, 70, 112477, 30),
  ('cl-office-box', 'Cloud services', 'Turnkey packages', 'Office IT-in-a-Box', 'Desks · Wi‑Fi · PCs · phones · go-live ready', 2624925, 2624925, 1837448, 70, 787477, 30),
  ('cl-dc-operate', 'Cloud services', 'Turnkey packages', 'Datacenter Build & Run', 'Design · rack · power · operate · handover', 5999925, 5999925, 4199948, 70, 1799977, 30),
  ('cl-dr-pack', 'Cloud services', 'Turnkey packages', 'Business Continuity Pack', 'Backup · failover · tested recovery playbooks', 1874925, 1874925, 1312448, 70, 562477, 30),
  ('cl-maas', 'Cloud services', 'Turnkey packages', 'Monitoring-as-a-Service', 'Dashboards · alerts · compliance views', 149925, 149925, 104948, 70, 44977, 30),
  ('cl-edtech', 'Cloud services', 'Turnkey packages', 'Learning Platform Pack', 'LMS · secure video · student portal', 4499925, 4499925, 3149948, 70, 1349977, 30),
  ('cl-ott-pack', 'Cloud services', 'Turnkey packages', 'Streaming Platform Pack', 'Catalogue · player · CDN · monetisation ready', 5249925, 5249925, 3674948, 70, 1574977, 30)
ON CONFLICT (service_id) DO NOTHING;

-- Backfill public prices from seed
INSERT INTO service_prices_public (service_id, price_paise, mrp_paise, updated_at)
SELECT
  service_id,
  new_amount_paise,
  GREATEST(current_amount_paise, ROUND(new_amount_paise / 0.75)::INTEGER),
  NOW()
FROM service_pricing
ON CONFLICT (service_id) DO NOTHING;
