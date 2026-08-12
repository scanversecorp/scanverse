-- Daily GPS status checks (run before admin GPS report)

CREATE TABLE IF NOT EXISTS gps_daily_status (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  TEXT NOT NULL CHECK (entity_type IN ('user', 'vendor')),
  entity_id    TEXT NOT NULL,
  check_date   DATE NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('shared', 'unshared')),
  lat          DOUBLE PRECISION,
  lng          DOUBLE PRECISION,
  gps_at       TIMESTAMPTZ,
  source       TEXT NOT NULL DEFAULT 'daily_check',
  checked_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_type, entity_id, check_date)
);

CREATE INDEX IF NOT EXISTS idx_gps_daily_status_date
  ON gps_daily_status(check_date DESC);

CREATE INDEX IF NOT EXISTS idx_gps_daily_status_entity
  ON gps_daily_status(entity_type, entity_id, check_date DESC);

ALTER TABLE gps_daily_status ENABLE ROW LEVEL SECURITY;
