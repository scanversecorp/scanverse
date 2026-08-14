-- India-ready social stack: add Threads, mark TikTok optional (banned IN)

ALTER TABLE scanv_social_content DROP CONSTRAINT IF EXISTS scanv_social_content_platform_check;
ALTER TABLE scanv_social_content ADD CONSTRAINT scanv_social_content_platform_check
  CHECK (platform IN ('all', 'facebook', 'instagram', 'threads', 'tiktok', 'youtube', 'youtube_shorts'));

INSERT INTO scanv_social_content (id, week_number, day_number, title, content_type, platform, caption, format_notes, sort_order) VALUES
  ('w1-d1-threads', 1, 1, 'Day 1 — Launch on Threads', 'post', 'threads',
   'Your mess. Our problem. 😉 ScanV just dropped for Pune & PCMC — one app for local services. Link below.',
   'Cross-post from IG caption · Meta text-first', 15),
  ('w1-d2-threads', 1, 2, 'Day 2 — Threads household hook', 'post', 'threads',
   'Deep clean so good you''ll pretend you did it 💅 Wakad & PCMC on ScanV.',
   'Cheeky one-liner + app link', 15),
  ('w1-d3-threads', 1, 3, 'Day 3 — Threads how-it-works', 'post', 'threads',
   'Browse → Book → UPI → Track. That''s the whole situationship. ScanV 📱',
   NULL, 15)
ON CONFLICT (id) DO UPDATE SET caption = EXCLUDED.caption, updated_at = NOW();

UPDATE scanv_social_content SET format_notes = 'India: use Reels not TikTok (TikTok banned). Repost to Shorts + Threads.'
WHERE platform = 'tiktok';
