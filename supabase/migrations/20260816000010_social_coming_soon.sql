-- Coming Soon messaging across social calendar

UPDATE scanv_social_content SET caption = 'Your mess. Our problem. 😉

🚀 COMING SOON to Pune & PCMC — ScanV is almost here.

One app for cleaning, delivery & more. Verified waale. UPI on app. Track it.
Register now · be first at launch 👇
https://scanv-tau.vercel.app?utm_source=social&utm_medium=coming_soon', updated_at = NOW()
WHERE id = 'w1-d1-launch-post';

UPDATE scanv_social_content SET caption = '🚀 COMING SOON — Pune madhe services, ekach app. Your mess. Our problem. 😉 Preview: scanv-tau.vercel.app', updated_at = NOW()
WHERE id = 'w1-d1-launch-reel';

UPDATE scanv_social_content SET caption = 'ScanV coming soon 🚀 — tap link · get on the list · Pune & PCMC', updated_at = NOW()
WHERE id = 'w1-d1-story-link';

UPDATE scanv_social_content SET caption = 'Deep clean so good you''ll pretend you did it 💅 — 🚀 COMING SOON on ScanV for Wakad & PCMC. Register now.', updated_at = NOW()
WHERE id = 'w1-d2-household-post';

UPDATE scanv_social_content SET caption = 'Browse → Book → UPI → Track. 🚀 COMING SOON — that''s ScanV. Pune & PCMC.', updated_at = NOW()
WHERE id = 'w1-d3-how-post';

UPDATE scanv_social_content SET caption = 'Wakad · Hinjewadi · Baner · PCMC — partner network loading 🚀 COMING SOON. Your area next? 👀', updated_at = NOW()
WHERE id = 'w1-d4-pcmc-post';

UPDATE scanv_social_content SET caption = 'Local vendor? 🚀 ScanV COMING SOON — register for launch, listing fee nahi 😏 WhatsApp 9270194842', updated_at = NOW()
WHERE id = 'w1-d5-partner-post';

UPDATE scanv_social_content SET caption = 'Verified partners only. OTP. Secure UPI. 🚀 COMING SOON — trust the process.', updated_at = NOW()
WHERE id = 'w1-d6-trust-post';

UPDATE scanv_social_content SET caption = '🚀 COMING SOON — thank you for the hype Pune! Week 1 waitlist energy. Link in bio.', updated_at = NOW()
WHERE id = 'w1-d7-recap-post';

UPDATE scanv_social_content SET caption = 'Your mess. Our problem. 😉 🚀 ScanV COMING SOON to Pune & PCMC — one app for local services.', updated_at = NOW()
WHERE id IN ('w1-d1-threads', 'w1-d2-threads', 'w1-d3-threads');

UPDATE scanv_social_content SET caption = REPLACE(caption, 'on ScanV', 'on ScanV 🚀 COMING SOON')
WHERE week_number = 2 AND caption NOT LIKE '%COMING SOON%';

UPDATE scanv_social_content SET caption = caption || E'\n\n🚀 COMING SOON to Pune & PCMC — register now · launch first.'
WHERE week_number = 2 AND is_daily_everywhere = TRUE AND caption NOT LIKE '%COMING SOON%';

UPDATE scanv_social_content SET caption = '10 cards. One app. 🚀 COMING SOON to Pune & PCMC.

Open ScanV → pick service → OTP → join waitlist · first booking at launch.
https://scanv-tau.vercel.app?utm_source=social&utm_medium=coming_soon_user', updated_at = NOW()
WHERE id = 'w2-d6-register-user';

UPDATE scanv_social_content SET caption = '🚀 COMING SOON — recruiting partners across all 10 categories.

Register for launch · listing fee nahi 😏
https://scanv-tau.vercel.app/#vendor-onboard?utm_source=social&utm_medium=coming_soon_partner
WhatsApp: 9270194842', updated_at = NOW()
WHERE id = 'w2-d7-register-partner';
