-- ScanV: platform settings (admin-controlled dispatch mode)

CREATE TABLE IF NOT EXISTS platform_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  TEXT
);

INSERT INTO platform_settings (key, value, description)
VALUES (
  'dispatch_mode',
  'both',
  'Partner dispatch: both (in-app + SMS/call/WA backup), in_app, external, disabled'
)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- No public/authenticated access — edge functions use service role
REVOKE ALL ON platform_settings FROM anon, authenticated;

CREATE OR REPLACE FUNCTION touch_platform_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_platform_settings_updated ON platform_settings;
CREATE TRIGGER trg_platform_settings_updated
  BEFORE UPDATE ON platform_settings
  FOR EACH ROW EXECUTE FUNCTION touch_platform_settings_updated_at();
