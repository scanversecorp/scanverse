-- Unified tagline: Coming soon everywhere in Pune & PCMC

UPDATE scanv_social_config SET app_link = 'https://scanv-tau.vercel.app?utm_source=social&utm_medium=coming_soon_pune', updated_at = NOW() WHERE id = 'default';

UPDATE scanv_social_content SET caption = 'Your mess. Our problem. 😉

🚀 Coming soon everywhere in Pune & PCMC.

Wakad · Hinjewadi · Baner · PCMC — one app for cleaning, delivery & more.
Register now · launch first 👇
https://scanv-tau.vercel.app?utm_source=social&utm_medium=coming_soon_pune', updated_at = NOW()
WHERE id = 'w1-d1-launch-post';

UPDATE scanv_social_content SET caption = '🚀 Coming soon everywhere in Pune — ekach app. Your mess. Our problem. 😉 scanv-tau.vercel.app', updated_at = NOW()
WHERE id IN ('w1-d1-launch-reel', 'w1-d1-story-link');

UPDATE scanv_social_content SET caption = REPLACE(
  REPLACE(caption, 'COMING SOON to Pune & PCMC', 'Coming soon everywhere in Pune & PCMC'),
  'COMING SOON —', 'Coming soon everywhere in Pune —'
) WHERE caption LIKE '%COMING SOON%';

UPDATE scanv_social_content SET caption = REPLACE(caption, 'COMING SOON on ScanV', 'Coming soon everywhere in Pune on ScanV')
WHERE caption LIKE '%COMING SOON on ScanV%';

UPDATE scanv_social_content SET caption = '10 cards. One app. 🚀 Coming soon everywhere in Pune & PCMC.

Register now · launch first.
https://scanv-tau.vercel.app?utm_source=social&utm_medium=coming_soon_pune', updated_at = NOW()
WHERE id = 'w2-d6-register-user';

UPDATE scanv_social_content SET caption = '🚀 Coming soon everywhere in Pune & PCMC — partners register for launch.

Listing fee nahi 😏 · #vendor-onboard · 9270194842
https://scanv-tau.vercel.app/#vendor-onboard?utm_source=social&utm_medium=coming_soon_partner', updated_at = NOW()
WHERE id = 'w2-d7-register-partner';

UPDATE scanv_social_content SET caption = caption || E'\n\n🚀 Coming soon everywhere in Pune & PCMC.'
WHERE week_number IN (1, 2) AND is_daily_everywhere = TRUE AND caption NOT LIKE '%everywhere in Pune%';
