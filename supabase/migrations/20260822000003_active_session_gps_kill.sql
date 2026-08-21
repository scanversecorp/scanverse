-- GPS on live presence + admin kill (blocks the same browser tab from heartbeating back).

ALTER TABLE public.active_sessions
  ADD COLUMN IF NOT EXISTS village TEXT,
  ADD COLUMN IF NOT EXISTS pincode TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

CREATE TABLE IF NOT EXISTS public.active_session_kills (
  session_key TEXT PRIMARY KEY,
  killed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.active_session_kills ENABLE ROW LEVEL SECURITY;

DROP FUNCTION IF EXISTS public.upsert_active_session(text, text, text, text, text, text, text, text, text, text, text, text);

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
  p_device_type text DEFAULT NULL,
  p_village text DEFAULT NULL,
  p_pincode text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_session_key IS NULL OR length(trim(p_session_key)) < 8 THEN
    RAISE EXCEPTION 'invalid session_key';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.active_session_kills k
    WHERE k.session_key = trim(p_session_key)
  ) THEN
    RETURN jsonb_build_object('killed', true);
  END IF;

  INSERT INTO public.active_sessions (
    session_key, profile_id, user_name, mobile, city, state,
    village, pincode, address, lat, lng,
    card_id, card_label, sub_card_id, sub_card_label, screen, device_type, last_seen_at
  ) VALUES (
    trim(p_session_key),
    nullif(trim(coalesce(p_profile_id, '')), ''),
    nullif(trim(coalesce(p_user_name, '')), ''),
    nullif(trim(coalesce(p_mobile, '')), ''),
    nullif(trim(coalesce(p_city, '')), ''),
    nullif(trim(coalesce(p_state, '')), ''),
    nullif(trim(coalesce(p_village, '')), ''),
    nullif(trim(coalesce(p_pincode, '')), ''),
    nullif(trim(coalesce(p_address, '')), ''),
    p_lat,
    p_lng,
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
    village = COALESCE(EXCLUDED.village, active_sessions.village),
    pincode = COALESCE(EXCLUDED.pincode, active_sessions.pincode),
    address = COALESCE(EXCLUDED.address, active_sessions.address),
    lat = COALESCE(EXCLUDED.lat, active_sessions.lat),
    lng = COALESCE(EXCLUDED.lng, active_sessions.lng),
    card_id = EXCLUDED.card_id,
    card_label = EXCLUDED.card_label,
    sub_card_id = EXCLUDED.sub_card_id,
    sub_card_label = EXCLUDED.sub_card_label,
    screen = EXCLUDED.screen,
    device_type = COALESCE(EXCLUDED.device_type, active_sessions.device_type),
    last_seen_at = now();

  RETURN jsonb_build_object('killed', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_active_session(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, double precision, double precision
) TO anon, authenticated;

COMMENT ON FUNCTION public.upsert_active_session IS
  'Anonymous/authenticated heartbeat. Returns {killed:true} if admin ended this browser tab.';
