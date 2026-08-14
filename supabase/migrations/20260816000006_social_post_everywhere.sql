-- Daily post everywhere — per-platform tracking on cross-platform bundle posts

ALTER TABLE scanv_social_content
  ADD COLUMN IF NOT EXISTS platform_status JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_daily_everywhere BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE scanv_social_content SET is_daily_everywhere = TRUE WHERE id IN (
  'w1-d1-launch-post',
  'w1-d2-household-post',
  'w1-d3-how-post',
  'w1-d4-pcmc-post',
  'w1-d5-partner-post',
  'w1-d6-trust-post',
  'w1-d7-recap-post'
);

-- Also mark primary Reel/Short as video-everywhere companions (same caption, all video platforms)
UPDATE scanv_social_content SET is_daily_everywhere = TRUE WHERE id IN (
  'w1-d1-launch-reel',
  'w1-d2-household-reel',
  'w1-d3-how-short',
  'w1-d7-recap-short'
);
