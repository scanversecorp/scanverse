-- Customer GPS consent log (day-wise status reports)

CREATE TABLE IF NOT EXISTS user_locations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  address       TEXT,
  village       TEXT,
  city          TEXT,
  pincode       TEXT,
  source        TEXT NOT NULL DEFAULT 'gps',
  consent_given BOOLEAN NOT NULL DEFAULT TRUE,
  consent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_locations_user_time
  ON user_locations(user_id, consent_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_locations_consent_day
  ON user_locations((timezone('Asia/Kolkata', consent_at)::date));

ALTER TABLE user_locations ENABLE ROW LEVEL SECURITY;
