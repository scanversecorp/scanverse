-- Week 3 pre-launch: "I'm coming HOT" — user + vendor waitlist push

INSERT INTO scanv_social_content (id, week_number, day_number, title, content_type, platform, caption, format_notes, is_daily_everywhere, sort_order) VALUES
  ('w3-d1-coming-hot', 3, 1, 'Prelaunch — I''m coming HOT', 'campaign', 'all',
   'Pune, I''m coming. HOT. 🔥

One App for everything.
Local community · Local support · Global happiness.

🚀 Coming soon everywhere in Pune & PCMC.
Your mess. Our problem. 😉

Need a service? Register now 👇
https://scanv-tau.vercel.app?utm_source=social&utm_medium=user_register

Got skills? Join as partner 👇
https://scanv-tau.vercel.app/#vendor-onboard?utm_source=social&utm_medium=partner_register',
   'Carousel or static + Reel/Short 15s · both CTAs', TRUE, 5),

  ('w3-d2-user-waitlist', 3, 2, 'Prelaunch — User waitlist', 'campaign', 'all',
   'Still saving random numbers in Notes app? 📱

ScanV is coming HOT — cleaning, delivery, food, health & more.
Open app → OTP → you''re on the list. Launch first. Zero drama.

🚀 Coming soon everywhere in Pune & PCMC.
https://scanv-tau.vercel.app?utm_source=social&utm_medium=user_register',
   'User CTA focus · Marathi hook in Stories', TRUE, 5),

  ('w3-d3-partner-waitlist', 3, 3, 'Prelaunch — Partner waitlist', 'campaign', 'all',
   'Still taking bookings on 4 WhatsApp groups? 😭

ScanV is coming HOT for Pune & PCMC partners.
Deep clean · delivery · food · mechanics · legal · more.
Listing fee on launch: nahi 😏

https://scanv-tau.vercel.app/#vendor-onboard?utm_source=social&utm_medium=partner_register
Questions: 9270194842',
   'Partner CTA · WhatsApp story sticker', TRUE, 5),

  ('w3-d4-ten-services', 3, 4, 'Prelaunch — 10 services dual CTA', 'carousel', 'all',
   '10 cards. One app. I''m coming HOT. 🔥

🧹 Household · 📦 Delivery · 🍱 Food · 🛵 2-Wheeler · 🚗 4-Wheeler
🏥 Health · 🏡 Property · ⚖️ Legal · 👑 VIP · ☁️ Cloud

Need one? Register as user.
Got one? Register as partner.
🚀 Coming soon everywhere in Pune & PCMC.

User → scanv-tau.vercel.app
Partner → scanv-tau.vercel.app/#vendor-onboard',
   '12-slide carousel · one service per slide', TRUE, 5),

  ('w3-d5-countdown', 3, 5, 'Prelaunch — Launch loading', 'campaign', 'all',
   'Launch loading… ████████░░ 80%

Pune & PCMC — we''re stacking verified partners AND early users.
Don''t be the one who finds out after your neighbour already booked.

🚀 Coming soon everywhere in Pune & PCMC.
Your mess. Our problem. 😉

Users → https://scanv-tau.vercel.app?utm_source=social&utm_medium=user_register
Partners → https://scanv-tau.vercel.app/#vendor-onboard?utm_source=social&utm_medium=partner_register',
   'Countdown sticker Stories · poll "Ready?"', TRUE, 5),

  ('w3-d6-user-emotional', 3, 6, 'Prelaunch — User emotional', 'emotional_story', 'all',
   'When your parents say "we''re visiting tomorrow" — you shouldn''t panic-clean at 2 AM. 👀

ScanV is coming HOT so Pune can book verified help in minutes.
Register now. Thank yourself later.

🚀 Coming soon everywhere in Pune & PCMC.
https://scanv-tau.vercel.app?utm_source=social&utm_medium=user_register',
   'Face-to-camera or text video · user CTA end card', TRUE, 5),

  ('w3-d7-partner-emotional', 3, 7, 'Prelaunch — Partner emotional', 'emotional_story', 'all',
   'Every local vendor deserves digital customers — without giant commissions.

ScanV is coming HOT. We''re building the partner network NOW.
Join before launch. First movers get the first bookings.

https://scanv-tau.vercel.app/#vendor-onboard?utm_source=social&utm_medium=partner_register
WhatsApp: 9270194842',
   'Partner POV · Marathi optional · vendor-onboard CTA', TRUE, 5),

  ('w3-story-dual-cta', 3, 1, 'Story — dual register links', 'story', 'instagram',
   'I''m coming HOT 🔥 · User link + Partner link · 9270194842', '4-frame story pack daily', FALSE, 20),
  ('w3-story-poll', 3, 5, 'Story — need vs provide poll', 'story', 'instagram',
   'Poll: Need service or provide service? · Book / Partner', 'Link stickers both URLs', FALSE, 25)
ON CONFLICT (id) DO UPDATE SET
  caption = EXCLUDED.caption,
  title = EXCLUDED.title,
  format_notes = EXCLUDED.format_notes,
  is_daily_everywhere = EXCLUDED.is_daily_everywhere,
  updated_at = NOW();
