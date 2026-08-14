-- Per-card business pipeline — revenue targets and next actions (all 10 ScanV cards)

CREATE TABLE IF NOT EXISTS scanv_card_business (
  card_id                 TEXT PRIMARY KEY,
  label                   TEXT NOT NULL,
  icon                    TEXT,
  revenue_priority        INT NOT NULL DEFAULT 50,
  target_active_vendors   INT NOT NULL DEFAULT 5,
  go_live_phase           TEXT NOT NULL DEFAULT 'recruiting'
    CHECK (go_live_phase IN ('research', 'recruiting', 'soft_launch', 'live', 'paused')),
  next_action             TEXT,
  blocker                 TEXT,
  notes                   TEXT,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_scanv_card_business_updated ON scanv_card_business;
CREATE TRIGGER trg_scanv_card_business_updated
  BEFORE UPDATE ON scanv_card_business
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

ALTER TABLE scanv_card_business ENABLE ROW LEVEL SECURITY;

INSERT INTO scanv_card_business (card_id, label, icon, revenue_priority, target_active_vendors, go_live_phase, next_action, blocker) VALUES
  ('household', 'Household services', '🧹', 10, 8, 'soft_launch', 'Validate top 5 Wakad/PCMC leads → Add to ScanV', 'Need 4-check validation on pink/green vendors'),
  ('delivery', 'Deliveries', '📦', 15, 3, 'recruiting', 'Logistics API (Porter/Borzo) + onboard 2 local couriers', 'Awaiting 3PL sandbox keys'),
  ('food', 'Food', '🍱', 20, 5, 'recruiting', 'Onboard 2 tiffin + 1 restaurant in Wakad', 'Only 3 vendors in catalog'),
  ('two-wheeler', 'Two Wheeler Support', '🛵', 25, 4, 'recruiting', 'Add 2 mechanics with GPS + roadside', 'Low vendor count (3)'),
  ('four-wheeler', 'Four Wheeler Support', '🚗', 30, 4, 'recruiting', 'Partner garages Hinjewadi/Baner — validate Aadhaar', 'Only 4 catalog vendors'),
  ('health', 'Health care', '🏥', 35, 3, 'research', 'Home visit doctors + lab sample pickup partners', 'Regulatory review for clinical'),
  ('property', 'Property & rentals', '🏠', 40, 3, 'research', '2 brokers + 1 verification agent PCMC', 'Low catalog coverage'),
  ('legal', 'Legal services', '⚖️', 45, 3, 'research', 'Recruit 2 more advocates — only 2 in catalog', 'Bar council verification'),
  ('vip', 'VIP appointments', '👑', 50, 2, 'research', 'Concierge + travel desk partners', 'Niche supply'),
  ('cloud', 'Cloud services', '☁️', 55, 2, 'research', 'DCORE/VanguardNode as anchor + 1 MSP partner', 'B2B sales cycle')
ON CONFLICT (card_id) DO UPDATE SET
  label = EXCLUDED.label,
  next_action = EXCLUDED.next_action,
  blocker = EXCLUDED.blocker,
  updated_at = NOW();
