-- Week 2 ad campaign: all services + user/partner register CTAs

ALTER TABLE scanv_social_content DROP CONSTRAINT IF EXISTS scanv_social_content_day_number_check;
ALTER TABLE scanv_social_content ADD CONSTRAINT scanv_social_content_day_number_check
  CHECK (day_number BETWEEN 1 AND 7);

ALTER TABLE scanv_social_content DROP CONSTRAINT IF EXISTS scanv_social_content_content_type_check;
ALTER TABLE scanv_social_content ADD CONSTRAINT scanv_social_content_content_type_check
  CHECK (content_type IN ('post', 'video', 'reel', 'short', 'story', 'carousel', 'emotional_story', 'campaign'));

INSERT INTO scanv_social_content (id, week_number, day_number, title, content_type, platform, caption, format_notes, is_daily_everywhere, sort_order) VALUES
  ('w2-d1-services-hh-dl', 2, 1, 'Week 2 — Household + Delivery', 'campaign', 'all',
   'Flat messy? Parcel stuck? One app. 🧹 Deep clean + 📦 courier on ScanV — verified waale, UPI, track. Your mess. Our problem. 😉

Book: https://scanv-tau.vercel.app?utm_source=social&utm_medium=user_register
Partner (cleaners/couriers): https://scanv-tau.vercel.app/#vendor-onboard?utm_source=social&utm_medium=partner_register',
   'Carousel: 2 cards + dual CTA slide', TRUE, 5),

  ('w2-d2-services-food-tw', 2, 2, 'Week 2 — Food + Two Wheeler', 'campaign', 'all',
   'Tiffin craving or bike crying? 🍱 Food + 🛵 mechanic on ScanV. Book before you regret it.

Users → scanv-tau.vercel.app · Partners → #vendor-onboard · 9270194842',
   'Reel: split screen food + bike', TRUE, 5),

  ('w2-d3-services-fw-health', 2, 3, 'Week 2 — Four Wheeler + Health', 'campaign', 'all',
   'Car service pick-up or doctor home visit? 🚗 🏥 ScanV sorts both. Live tracking. No drama.',
   'Static + app screenshot', TRUE, 5),

  ('w2-d4-services-prop-legal', 2, 4, 'Week 2 — Property + Legal', 'campaign', 'all',
   'Rent stress or legal mess? 🏡 ⚖️ Property + lawyers on one app. Pune problems, one solution.',
   'Infographic 2-column', TRUE, 5),

  ('w2-d5-services-vip-cloud', 2, 5, 'Week 2 — VIP + Cloud', 'campaign', 'all',
   'VIP concierge or cloud for your business? 👑 ☁️ ScanV premium + B2B lane is open.',
   'Premium aesthetic post', TRUE, 5),

  ('w2-d6-register-user', 2, 6, 'Week 2 — Register as USER', 'campaign', 'all',
   '10 cards. One app. Pune & PCMC. 🧹📦🍱🛵🚗🏥🏡⚖️👑☁️

Open ScanV → pick service → OTP → book → UPI → track.
No account drama. First booking = you''re in.

https://scanv-tau.vercel.app?utm_source=social&utm_medium=user_register',
   'Mega carousel all 10 home cards', TRUE, 5),

  ('w2-d7-register-partner', 2, 7, 'Week 2 — Register as PARTNER', 'campaign', 'all',
   'Got skills? Got a shop? Got a van? Join ScanV across all 10 categories.

✓ OTP + eKYC · ✓ digital bookings · ✓ UPI payouts
Launch pe listing fee nahi 😏

https://scanv-tau.vercel.app/#vendor-onboard?utm_source=social&utm_medium=partner_register
WhatsApp: 9270194842',
   'Partner CTA video + WhatsApp sticker story', TRUE, 5),

  ('w2-story-user', 2, 6, 'Story — book as user', 'story', 'instagram',
   'Need a service? Tap → scanv-tau.vercel.app', 'Link sticker', FALSE, 20),
  ('w2-story-partner', 2, 7, 'Story — join as partner', 'story', 'instagram',
   'Provide services? Join ScanV → vendor-onboard', 'Link sticker + 9270194842', FALSE, 20)
ON CONFLICT (id) DO UPDATE SET caption = EXCLUDED.caption, title = EXCLUDED.title, updated_at = NOW();
