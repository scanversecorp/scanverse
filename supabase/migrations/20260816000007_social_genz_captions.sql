-- Gen-Z social captions — update daily everywhere bundles + key content

UPDATE scanv_social_content SET caption = 'Your mess. Our problem. 😉

ScanV just dropped in Pune & PCMC — book cleaning, delivery & more on one app. Verified waale. UPI on app. Track it.

Link in bio — go be main character.
https://getscanv.com?utm_source=social&utm_medium=genz', format_notes = 'Carousel or 15s Reel · cheeky launch energy · all 5 platforms', updated_at = NOW()
WHERE id = 'w1-d1-launch-post';

UPDATE scanv_social_content SET caption = 'POV: Pune madhe services — ekach app. Your mess. Our problem. 😉 UPI · track · no drama.', format_notes = '15s screen record · repost Reels + Shorts + TikTok', updated_at = NOW()
WHERE id = 'w1-d1-launch-reel';

UPDATE scanv_social_content SET caption = 'Poll: Flat messy aahe ka? 😭 Yes / Obviously', updated_at = NOW()
WHERE id = 'w1-d1-story-poll';

UPDATE scanv_social_content SET caption = 'ScanV is live — tap link. Your mess, our problem 😉', updated_at = NOW()
WHERE id = 'w1-d1-story-link';

UPDATE scanv_social_content SET caption = 'We built ScanV because booking help shouldn''t feel like a side quest. Pune families deserve simple.', updated_at = NOW()
WHERE id = 'w1-d1-emotional';

UPDATE scanv_social_content SET caption = 'Deep clean so good you''ll pretend you did it yourself. 💅

Wakad & PCMC — verified deep cleaning on ScanV. Book before guests arrive (you know the vibe).

Wakad madhe deep cleaning? ScanV var 2 min.
https://getscanv.com?utm_source=social&utm_medium=genz', updated_at = NOW()
WHERE id = 'w1-d2-household-post';

UPDATE scanv_social_content SET caption = 'Wakad madhe deep cleaning? ScanV var 2 minute. Flat spotless — tu credit ghe. 😉', updated_at = NOW()
WHERE id = 'w1-d2-household-reel';

UPDATE scanv_social_content SET caption = 'Parents visiting tomorrow? 👀 Book deep clean on ScanV.', updated_at = NOW()
WHERE id = 'w1-d2-story-tip';

UPDATE scanv_social_content SET caption = 'Browse → Book → UPI → Track. That''s the whole situationship. 📱 No drama. Infinite chill.', updated_at = NOW()
WHERE id = 'w1-d3-how-post';

UPDATE scanv_social_content SET caption = '4 steps. 0 drama. ScanV in 30 seconds.', updated_at = NOW()
WHERE id = 'w1-d3-how-short';

UPDATE scanv_social_content SET caption = 'Wakad · Hinjewadi · Baner · PCMC — partner network loading. Your area next? 👀', updated_at = NOW()
WHERE id = 'w1-d4-pcmc-post';

UPDATE scanv_social_content SET caption = 'Every local vendor deserves customers without giant commissions. ScanV partners with Pune businesses.', updated_at = NOW()
WHERE id = 'w1-d4-emotional';

UPDATE scanv_social_content SET caption = 'Local vendor? Join ScanV — launch pe listing fee nahi. 😏 WhatsApp 9270194842', updated_at = NOW()
WHERE id = 'w1-d5-partner-post';

UPDATE scanv_social_content SET caption = 'Still on 4 WhatsApp groups for bookings? Upgrade. Partner ScanV — zero listing fee 😏', updated_at = NOW()
WHERE id = 'w1-d5-partner-video';

UPDATE scanv_social_content SET caption = 'Verified partners only. OTP login. Secure UPI. We keep it clean — every sense. 🔒', updated_at = NOW()
WHERE id = 'w1-d6-trust-post';

UPDATE scanv_social_content SET caption = 'Booking help shouldn''t feel embarrassing. ScanV keeps it on the app — simple for Pune families.', updated_at = NOW()
WHERE id = 'w1-d6-emotional';

UPDATE scanv_social_content SET caption = 'Week 1 on ScanV — Pune, you were kinda iconic. ✨ Dhanyavad · link in bio · don''t ghost us.', updated_at = NOW()
WHERE id = 'w1-d7-recap-post';

UPDATE scanv_social_content SET caption = 'Your mess. Our problem. 😉 Week 1 recap — thank you Pune & PCMC!', updated_at = NOW()
WHERE id = 'w1-d7-recap-short';

UPDATE scanv_social_content SET caption = 'To everyone who tried ScanV — dhanyavad. We''re just getting started. Your city. One app.', updated_at = NOW()
WHERE id = 'w1-d7-emotional';

UPDATE scanv_social_config SET handle = 'scanvapp', updated_at = NOW() WHERE id = 'default';
