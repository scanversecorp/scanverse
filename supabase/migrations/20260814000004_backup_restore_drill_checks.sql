-- Backup & restore drill checklist items (Admin Hub → Go-Live)

INSERT INTO platform_settings (key, value, description)
SELECT k, '0', d FROM (VALUES
  ('go_live_check_supabase_pro_backups', 'Supabase Pro daily backups enabled'),
  ('go_live_check_db_restore_drill', 'Database restore drill completed (see docs/BACKUP-AND-SCALE.md)')
) AS t(k, d)
ON CONFLICT (key) DO NOTHING;
