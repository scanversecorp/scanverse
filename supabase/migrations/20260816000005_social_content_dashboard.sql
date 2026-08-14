-- ScanV social media content calendar + posting tracker (admin dashboard)

CREATE TABLE IF NOT EXISTS scanv_social_config (
  id                TEXT PRIMARY KEY DEFAULT 'default',
  week_start_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  handle            TEXT NOT NULL DEFAULT 'scanvapp',
  app_link          TEXT NOT NULL DEFAULT 'https://scanv-tau.vercel.app',
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scanv_social_content (
  id              TEXT PRIMARY KEY,
  week_number     INT NOT NULL DEFAULT 1,
  day_number      INT NOT NULL CHECK (day_number BETWEEN 1 AND 7),
  scheduled_date  DATE,
  title           TEXT NOT NULL,
  content_type    TEXT NOT NULL DEFAULT 'post'
    CHECK (content_type IN ('post', 'video', 'reel', 'short', 'story', 'carousel', 'emotional_story')),
  platform        TEXT NOT NULL DEFAULT 'all'
    CHECK (platform IN ('all', 'facebook', 'instagram', 'tiktok', 'youtube', 'youtube_shorts')),
  caption         TEXT,
  format_notes    TEXT,
  script_ref      TEXT,
  emotional       BOOLEAN NOT NULL DEFAULT FALSE,
  post_status     TEXT NOT NULL DEFAULT 'planned'
    CHECK (post_status IN ('planned', 'drafted', 'scheduled', 'posted', 'skipped')),
  post_url        TEXT,
  scheduled_at    TIMESTAMPTZ,
  posted_at       TIMESTAMPTZ,
  notes           TEXT,
  sort_order      INT NOT NULL DEFAULT 50,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_content_week_day
  ON scanv_social_content (week_number, day_number, sort_order);
CREATE INDEX IF NOT EXISTS idx_social_content_status
  ON scanv_social_content (post_status);
CREATE INDEX IF NOT EXISTS idx_social_content_scheduled
  ON scanv_social_content (scheduled_date)
  WHERE scheduled_date IS NOT NULL;

DROP TRIGGER IF EXISTS trg_scanv_social_config_updated ON scanv_social_config;
CREATE TRIGGER trg_scanv_social_config_updated
  BEFORE UPDATE ON scanv_social_config
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_scanv_social_content_updated ON scanv_social_content;
CREATE TRIGGER trg_scanv_social_content_updated
  BEFORE UPDATE ON scanv_social_content
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

ALTER TABLE scanv_social_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE scanv_social_content ENABLE ROW LEVEL SECURITY;

INSERT INTO scanv_social_config (id, week_start_date, handle, app_link) VALUES
  ('default', CURRENT_DATE, 'scanvapp', 'https://scanv-tau.vercel.app')
ON CONFLICT (id) DO NOTHING;

INSERT INTO scanv_social_content (id, week_number, day_number, title, content_type, platform, caption, format_notes, script_ref, emotional, sort_order) VALUES
  ('w1-d1-launch-post', 1, 1, 'Day 1 — Launch announcement', 'carousel', 'all',
   'ScanV is here for Pune & PCMC — book local services on one app. Try the app · Link in bio https://scanv-tau.vercel.app?utm_source=social&utm_medium=organic',
   'Carousel (home screen) or static + all platforms', NULL, FALSE, 10),
  ('w1-d1-launch-reel', 1, 1, 'Day 1 — App demo Reel/Short', 'reel', 'all',
   'Pune madhe services book karaycha ekach app? ScanV — UPI payment · track booking.',
   '15s screen record · repost to Reels, Shorts, TikTok', '#1', FALSE, 20),
  ('w1-d1-story-poll', 1, 1, 'Story — service poll', 'story', 'instagram',
   'Poll: Which service first? Cleaning / Delivery / Food', 'IG + FB Stories sticker poll', NULL, FALSE, 30),
  ('w1-d1-story-link', 1, 1, 'Story — link sticker', 'story', 'instagram',
   'ScanV is live — tap link · Pune & PCMC', 'Link sticker → scanv-tau.vercel.app', NULL, FALSE, 40),
  ('w1-d1-emotional', 1, 1, 'Emotional — why ScanV for Pune', 'emotional_story', 'instagram',
   'We built ScanV because booking local help in Pune should be simple — one app, verified partners, no chasing.',
   'Face-to-camera or text-on-video · Marathi optional hook', NULL, TRUE, 50),

  ('w1-d2-household-post', 1, 2, 'Day 2 — Household deep cleaning', 'post', 'all',
   'Deep cleaning in Wakad? Book verified partners on ScanV. Wakad madhe deep cleaning — ScanV var book kara.',
   'Reel + Facebook post', NULL, FALSE, 10),
  ('w1-d2-household-reel', 1, 2, 'Day 2 — Marathi hook Reel', 'reel', 'all',
   'Wakad madhe deep cleaning pahije? ScanV var 2 minute.',
   'Show booking flow · end with app link', '#2', FALSE, 20),
  ('w1-d2-story-tip', 1, 2, 'Story — booking tip', 'story', 'instagram',
   'Tip: Book deep cleaning 24h ahead on ScanV for best slots.', 'Text sticker + app link', NULL, FALSE, 30),

  ('w1-d3-how-post', 1, 3, 'Day 3 — How ScanV works', 'carousel', 'all',
   'Browse → Book → Pay UPI → Track. That''s ScanV.',
   '3-slide carousel / Short', NULL, FALSE, 10),
  ('w1-d3-how-short', 1, 3, 'Day 3 — Flow Short', 'short', 'youtube_shorts',
   'Browse → Book → Pay UPI → Track — ScanV in 30 seconds.',
   'Screen record each step · YouTube Short + TikTok', '#1', FALSE, 20),
  ('w1-d3-story-steps', 1, 3, 'Story — 4 steps', 'story', 'instagram',
   '4 steps: Browse · Book · UPI · Track', 'One step per story frame', NULL, FALSE, 30),

  ('w1-d4-pcmc-post', 1, 4, 'Day 4 — PCMC coverage', 'post', 'all',
   'PCMC + Hinjewadi + Baner — we''re building partner network now.',
   'Map graphic or area list', NULL, FALSE, 10),
  ('w1-d4-story-areas', 1, 4, 'Story — area quiz', 'story', 'instagram',
   'Which area next? Wakad / Hinjewadi / Baner / PCMC', 'Poll or question sticker', NULL, FALSE, 20),
  ('w1-d4-emotional', 1, 4, 'Emotional — local vendor dream', 'emotional_story', 'instagram',
   'Every local vendor deserves digital customers without big commissions — that''s why ScanV partners with Pune businesses.',
   'Partner B-roll or quote card · tag partner when live', NULL, TRUE, 30),

  ('w1-d5-partner-post', 1, 5, 'Day 5 — Partner recruitment', 'post', 'all',
   'Local vendor? Join ScanV launch — zero listing fee. WhatsApp 9270194842',
   'Static + Stories sticker link', '#4', FALSE, 10),
  ('w1-d5-partner-video', 1, 5, 'Day 5 — Partner CTA video', 'video', 'tiktok',
   'Local vendor? ScanV var partner vha — launch var listing fee nahi. 9270194842',
   'Text overlay + WhatsApp CTA', '#4', FALSE, 20),
  ('w1-d5-story-wa', 1, 5, 'Story — WhatsApp CTA', 'story', 'instagram',
   'Vendors: message us on WhatsApp 9270194842', 'Link sticker + phone sticker', NULL, FALSE, 30),

  ('w1-d6-trust-post', 1, 6, 'Day 6 — Trust & safety', 'carousel', 'all',
   'Verified partners · OTP login · Secure payment on app.',
   'Infographic carousel', NULL, FALSE, 10),
  ('w1-d6-story-trust', 1, 6, 'Story — trust badge', 'story', 'instagram',
   'Verified partners only on ScanV ✓', 'Static trust graphic', NULL, FALSE, 20),
  ('w1-d6-emotional', 1, 6, 'Emotional — customer peace of mind', 'emotional_story', 'facebook',
   'When you book home help, you shouldn''t worry about payment or tracking — ScanV keeps it on the app.',
   'Customer POV story · Hindi/Marathi voiceover OK', NULL, TRUE, 30),

  ('w1-d7-recap-post', 1, 7, 'Day 7 — Week recap', 'post', 'all',
   'Week 1 — thank you Pune! More services coming.',
   'Thank-you graphic + app link', NULL, FALSE, 10),
  ('w1-d7-recap-short', 1, 7, 'Day 7 — Week recap Short', 'short', 'youtube_shorts',
   'Week 1 on ScanV — thank you Pune & PCMC!',
   'Montage of week clips · YouTube Short + Reels', NULL, FALSE, 20),
  ('w1-d7-story-recap', 1, 7, 'Story — week highlights', 'story', 'instagram',
   'Week 1 highlights — swipe up for app', 'Repost best performing post', NULL, FALSE, 30),
  ('w1-d7-emotional', 1, 7, 'Emotional — thank you Pune', 'emotional_story', 'all',
   'To everyone who tried ScanV this week — dhanyavad. We''re just getting started for Pune & PCMC.',
   'Team thank-you · Marathi closing line', NULL, TRUE, 40),

  ('w1-vid-hindi-hook', 1, 3, 'Video — Hindi household hook', 'video', 'tiktok',
   'PCMC mein ghar ki safai — ScanV app se book karo. App link bio mein.',
   'Show price screen · TikTok + Reels', '#3', FALSE, 25),
  ('w1-vid-delivery-tease', 1, 5, 'Video — Delivery tease', 'video', 'all',
   'Pickup + drop — ScanV var book kara (coming soon)',
   'Show delivery card when live', '#5', FALSE, 35)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  caption = EXCLUDED.caption,
  format_notes = EXCLUDED.format_notes,
  updated_at = NOW();
