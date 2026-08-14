-- ScanV IAM: roles, permissions, staff users, PIN→role mapping (secrets stay in env)

CREATE TABLE IF NOT EXISTS iam_roles (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  description TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS iam_permissions (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  domain      TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS iam_role_permissions (
  role_id       TEXT NOT NULL REFERENCES iam_roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES iam_permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS iam_pin_role_map (
  pin_key     TEXT NOT NULL,
  role_id     TEXT NOT NULL REFERENCES iam_roles(id) ON DELETE CASCADE,
  description TEXT,
  PRIMARY KEY (pin_key, role_id)
);

CREATE TABLE IF NOT EXISTS staff_users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id      UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  email             TEXT NOT NULL UNIQUE,
  display_name      TEXT NOT NULL,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  support_agent_id  UUID REFERENCES support_agents(id) ON DELETE SET NULL,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff_role_assignments (
  staff_id    UUID NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  role_id     TEXT NOT NULL REFERENCES iam_roles(id) ON DELETE CASCADE,
  granted_by  TEXT,
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (staff_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_users_auth ON staff_users(auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_staff_users_active ON staff_users(active) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_staff_role_assignments_role ON staff_role_assignments(role_id);

ALTER TABLE support_agents
  ADD COLUMN IF NOT EXISTS staff_user_id UUID REFERENCES staff_users(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS trg_staff_users_updated ON staff_users;
CREATE TRIGGER trg_staff_users_updated
  BEFORE UPDATE ON staff_users FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

ALTER TABLE iam_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam_pin_role_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_role_assignments ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE iam_roles IS 'ScanV staff IAM roles (owner, hub operator, support, pricing, vendor).';
COMMENT ON TABLE iam_permissions IS 'Fine-grained permission ids used by edge functions.';
COMMENT ON TABLE iam_pin_role_map IS 'Maps env PIN secret names to IAM roles — PIN values remain in Supabase secrets.';
COMMENT ON TABLE staff_users IS 'Staff identity for JWT auth; links to auth.users when staff signs in.';

-- ── Roles ──
INSERT INTO iam_roles (id, label, description, sort_order) VALUES
  ('scanv_owner', 'ScanV Owner', 'Executive dashboard, exec go-live switches, pricing 2FA reset, IAM admin', 10),
  ('hub_operator', 'Hub Operator', 'Full admin hub except owner-only exec controls', 20),
  ('support_admin', 'Support Admin', 'Customer support writes, refunds, ticket admin', 30),
  ('support_agent', 'Support Agent', 'Read-only support desk, cancel bookings, ticket updates', 40),
  ('pricing_admin', 'Pricing Admin', 'Pricing admin portal and catalog edits', 50),
  ('vendor_admin', 'Vendor Admin', 'Vendor onboarding, activation, vendor leads promotion', 60)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

-- ── Permissions ──
INSERT INTO iam_permissions (id, label, domain, description) VALUES
  ('hub.access', 'Hub access', 'hub', 'Enter admin hub / whoami'),
  ('hub.stats', 'Hub stats', 'hub', 'Dashboard counts and overview'),
  ('hub.agents', 'Support agents', 'hub', 'CRUD support_agents registry'),
  ('hub.bookings', 'Bookings desk', 'hub', 'Search and edit bookings'),
  ('hub.payments', 'Payments list', 'hub', 'View payment intents'),
  ('hub.refunds', 'Refunds queue', 'hub', 'Process pending refunds'),
  ('hub.investments', 'Investments', 'hub', 'Investment request responses'),
  ('hub.otp', 'OTP delivery', 'hub', 'OTP delivery reports'),
  ('hub.dispatch', 'Dispatch desk', 'hub', 'Dispatch search, control, assign'),
  ('hub.directory', 'Users directory', 'hub', 'Search users/vendors and edit profiles'),
  ('hub.gps', 'GPS compliance', 'hub', 'GPS status reports and daily checks'),
  ('hub.go_live.read', 'Go-live read', 'hub', 'View go-live config and checklist'),
  ('hub.go_live.switch', 'Go-live vendor switches', 'hub', 'Toggle vendor/provider flags'),
  ('hub.go_live.exec', 'Go-live exec switches', 'hub', 'otp_dev_mode, dispatch_open (owner only)'),
  ('hub.go_live.checklist', 'Go-live checklist', 'hub', 'Manual checklist ticks'),
  ('hub.go_live.ticket', 'Route ticket tracker', 'hub', 'Razorpay Route support ticket'),
  ('hub.settings', 'Platform settings', 'hub', 'dispatch_mode and platform_settings'),
  ('hub.exec', 'Executive dashboard', 'hub', 'exec_stats and exec_charts'),
  ('hub.pricing_2fa', 'Pricing 2FA reset', 'hub', 'Reset pricing admin TOTP enrollment'),
  ('hub.diagrams', 'Architecture diagrams', 'hub', 'Confidential Mermaid catalog'),
  ('hub.vendor_leads', 'Vendor leads', 'hub', 'Research catalog and ScanV enrollment'),
  ('hub.index', 'URL index', 'hub', 'Confidential admin bookmark index'),
  ('hub.iam', 'IAM admin', 'hub', 'Manage staff roles and view permission matrix'),
  ('support.read', 'Support read', 'support', 'Search profiles and bookings'),
  ('support.write', 'Support write', 'support', 'Update profiles and bookings'),
  ('support.cancel', 'Support cancel', 'support', 'Cancel customer bookings'),
  ('support.refund', 'Support refund', 'support', 'Update refund queue'),
  ('tickets.read', 'Tickets read', 'tickets', 'Search and view support tickets'),
  ('tickets.write', 'Tickets write', 'tickets', 'Assign and update tickets'),
  ('vendor.read', 'Vendor read', 'vendor', 'List and view vendor partners'),
  ('vendor.write', 'Vendor write', 'vendor', 'Activate, pause, offboard vendors'),
  ('vendor.enroll', 'Vendor enroll', 'vendor', 'Admin enroll new partners'),
  ('pricing.read', 'Pricing read', 'pricing', 'View pricing catalog'),
  ('pricing.write', 'Pricing write', 'pricing', 'Edit prices and publish')
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  domain = EXCLUDED.domain,
  description = EXCLUDED.description;

-- ── Role → permission grants ──
INSERT INTO iam_role_permissions (role_id, permission_id)
SELECT r, p FROM (VALUES
  ('scanv_owner', 'hub.access'), ('scanv_owner', 'hub.stats'), ('scanv_owner', 'hub.agents'),
  ('scanv_owner', 'hub.bookings'), ('scanv_owner', 'hub.payments'), ('scanv_owner', 'hub.refunds'),
  ('scanv_owner', 'hub.investments'), ('scanv_owner', 'hub.otp'), ('scanv_owner', 'hub.dispatch'),
  ('scanv_owner', 'hub.directory'), ('scanv_owner', 'hub.gps'), ('scanv_owner', 'hub.go_live.read'),
  ('scanv_owner', 'hub.go_live.switch'), ('scanv_owner', 'hub.go_live.exec'),
  ('scanv_owner', 'hub.go_live.checklist'), ('scanv_owner', 'hub.go_live.ticket'),
  ('scanv_owner', 'hub.settings'), ('scanv_owner', 'hub.exec'), ('scanv_owner', 'hub.pricing_2fa'),
  ('scanv_owner', 'hub.diagrams'), ('scanv_owner', 'hub.vendor_leads'), ('scanv_owner', 'hub.index'),
  ('scanv_owner', 'hub.iam'),
  ('scanv_owner', 'support.read'), ('scanv_owner', 'support.write'), ('scanv_owner', 'support.cancel'),
  ('scanv_owner', 'support.refund'), ('scanv_owner', 'tickets.read'), ('scanv_owner', 'tickets.write'),
  ('scanv_owner', 'vendor.read'), ('scanv_owner', 'vendor.write'), ('scanv_owner', 'vendor.enroll'),
  ('scanv_owner', 'pricing.read'), ('scanv_owner', 'pricing.write'),

  ('hub_operator', 'hub.access'), ('hub_operator', 'hub.stats'), ('hub_operator', 'hub.agents'),
  ('hub_operator', 'hub.bookings'), ('hub_operator', 'hub.payments'), ('hub_operator', 'hub.refunds'),
  ('hub_operator', 'hub.investments'), ('hub_operator', 'hub.otp'), ('hub_operator', 'hub.dispatch'),
  ('hub_operator', 'hub.directory'), ('hub_operator', 'hub.gps'), ('hub_operator', 'hub.go_live.read'),
  ('hub_operator', 'hub.go_live.switch'), ('hub_operator', 'hub.go_live.checklist'),
  ('hub_operator', 'hub.go_live.ticket'), ('hub_operator', 'hub.settings'),
  ('hub_operator', 'hub.diagrams'), ('hub_operator', 'hub.vendor_leads'), ('hub_operator', 'hub.index'),

  ('support_admin', 'support.read'), ('support_admin', 'support.write'), ('support_admin', 'support.cancel'),
  ('support_admin', 'support.refund'), ('support_admin', 'tickets.read'), ('support_admin', 'tickets.write'),

  ('support_agent', 'support.read'), ('support_agent', 'support.cancel'),
  ('support_agent', 'tickets.read'), ('support_agent', 'tickets.write'),

  ('pricing_admin', 'pricing.read'), ('pricing_admin', 'pricing.write'),
  ('pricing_admin', 'hub.stats'),

  ('vendor_admin', 'vendor.read'), ('vendor_admin', 'vendor.write'), ('vendor_admin', 'vendor.enroll'),
  ('vendor_admin', 'hub.vendor_leads')
) AS t(r, p)
ON CONFLICT DO NOTHING;

-- ── PIN secret name → roles (values live in Supabase secrets, not here) ──
INSERT INTO iam_pin_role_map (pin_key, role_id, description) VALUES
  ('ADMIN_HUB_PIN', 'scanv_owner', 'Owner / leader hub PIN'),
  ('ADMIN_HUB_PIN', 'hub_operator', 'Owner / leader hub PIN'),
  ('SUPPORT_ADMIN_PIN', 'scanv_owner', 'Support leader PIN'),
  ('SUPPORT_ADMIN_PIN', 'hub_operator', 'Support leader PIN'),
  ('SUPPORT_ADMIN_PIN', 'support_admin', 'Support leader PIN'),
  ('PRICING_ADMIN_PIN', 'hub_operator', 'Pricing admin hub access'),
  ('PRICING_ADMIN_PIN', 'pricing_admin', 'Pricing admin portal'),
  ('VENDOR_ADMIN_PIN', 'hub_operator', 'Vendor admin hub access'),
  ('VENDOR_ADMIN_PIN', 'vendor_admin', 'Vendor admin portal'),
  ('SUPPORT_AGENT_PIN', 'support_agent', 'Support agent desk PIN')
ON CONFLICT DO NOTHING;
