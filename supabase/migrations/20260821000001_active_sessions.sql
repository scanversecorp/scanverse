-- Live presence: which card / sub-card each browser tab is on (heartbeat upsert).

CREATE TABLE IF NOT EXISTS public.active_sessions (
  session_key      TEXT PRIMARY KEY,
  profile_id       TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_name        TEXT,
  mobile           TEXT,
  city             TEXT,
  state            TEXT,
  card_id          TEXT,
  card_label       TEXT,
  sub_card_id      TEXT,
  sub_card_label   TEXT,
  screen           TEXT,
  device_type      TEXT,
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_active_sessions_last_seen
  ON public.active_sessions(last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_active_sessions_profile
  ON public.active_sessions(profile_id)
  WHERE profile_id IS NOT NULL;

ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY active_sessions_admin_select ON public.active_sessions
  FOR SELECT
  TO authenticated
  USING (public.auth_is_admin());

COMMENT ON TABLE public.active_sessions IS
  'Client heartbeats — one row per browser tab; admin hub lists rows seen in the last few minutes.';

CREATE OR REPLACE FUNCTION public.upsert_active_session(
  p_session_key text,
  p_profile_id text DEFAULT NULL,
  p_user_name text DEFAULT NULL,
  p_mobile text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_card_id text DEFAULT NULL,
  p_card_label text DEFAULT NULL,
  p_sub_card_id text DEFAULT NULL,
  p_sub_card_label text DEFAULT NULL,
  p_screen text DEFAULT NULL,
  p_device_type text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_session_key IS NULL OR length(trim(p_session_key)) < 8 THEN
    RAISE EXCEPTION 'invalid session_key';
  END IF;

  INSERT INTO public.active_sessions (
    session_key, profile_id, user_name, mobile, city, state,
    card_id, card_label, sub_card_id, sub_card_label, screen, device_type, last_seen_at
  ) VALUES (
    trim(p_session_key),
    nullif(trim(coalesce(p_profile_id, '')), ''),
    nullif(trim(coalesce(p_user_name, '')), ''),
    nullif(trim(coalesce(p_mobile, '')), ''),
    nullif(trim(coalesce(p_city, '')), ''),
    nullif(trim(coalesce(p_state, '')), ''),
    nullif(trim(coalesce(p_card_id, '')), ''),
    nullif(trim(coalesce(p_card_label, '')), ''),
    nullif(trim(coalesce(p_sub_card_id, '')), ''),
    nullif(trim(coalesce(p_sub_card_label, '')), ''),
    nullif(trim(coalesce(p_screen, '')), ''),
    nullif(trim(coalesce(p_device_type, '')), ''),
    now()
  )
  ON CONFLICT (session_key) DO UPDATE SET
    profile_id = COALESCE(EXCLUDED.profile_id, active_sessions.profile_id),
    user_name = COALESCE(EXCLUDED.user_name, active_sessions.user_name),
    mobile = COALESCE(EXCLUDED.mobile, active_sessions.mobile),
    city = COALESCE(EXCLUDED.city, active_sessions.city),
    state = COALESCE(EXCLUDED.state, active_sessions.state),
    card_id = EXCLUDED.card_id,
    card_label = EXCLUDED.card_label,
    sub_card_id = EXCLUDED.sub_card_id,
    sub_card_label = EXCLUDED.sub_card_label,
    screen = EXCLUDED.screen,
    device_type = COALESCE(EXCLUDED.device_type, active_sessions.device_type),
    last_seen_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_active_session TO anon, authenticated;

COMMENT ON FUNCTION public.upsert_active_session IS
  'Anonymous/authenticated heartbeat — upserts one row per browser tab (session_key in sessionStorage).';
