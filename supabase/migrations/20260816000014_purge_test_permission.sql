-- Owner-only permission for pre-launch test data purge

INSERT INTO iam_permissions (id, label, domain, description) VALUES
  ('hub.purge_test', 'Purge test data', 'hub', 'Delete customer/partner profiles, bookings, and @scanv.app auth users (pre-launch only)')
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  domain = EXCLUDED.domain,
  description = EXCLUDED.description;

INSERT INTO iam_role_permissions (role_id, permission_id) VALUES
  ('scanv_owner', 'hub.purge_test')
ON CONFLICT DO NOTHING;
