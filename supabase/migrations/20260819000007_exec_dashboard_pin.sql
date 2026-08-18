-- Dedicated Executive Dashboard PIN (EXEC_DASHBOARD_PIN secret) — exec metrics only, not full admin hub.

INSERT INTO iam_roles (id, label, description, sort_order) VALUES
  ('exec_viewer', 'Executive viewer', 'Read-only executive dashboard (#exec) only', 15)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description;

INSERT INTO iam_role_permissions (role_id, permission_id) VALUES
  ('exec_viewer', 'hub.exec')
ON CONFLICT DO NOTHING;

INSERT INTO iam_pin_role_map (pin_key, role_id, description) VALUES
  ('EXEC_DASHBOARD_PIN', 'exec_viewer', 'Executive dashboard PIN (#exec)')
ON CONFLICT DO NOTHING;
