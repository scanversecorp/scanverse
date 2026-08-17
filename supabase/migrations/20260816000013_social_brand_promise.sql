-- Brand promise: One App for everything · Local community · Local support · Global happiness

UPDATE scanv_social_content SET caption = 'Pune, I''m coming. HOT. 🔥

One App for everything.
Local community · Local support · Global happiness.

🚀 Coming soon everywhere in Pune & PCMC.
Your mess. Our problem. 😉

Need a service? Register now 👇
https://getscanv.com?utm_source=social&utm_medium=user_register

Got skills? Join as partner 👇
https://getscanv.com/#vendor-onboard?utm_source=social&utm_medium=partner_register', updated_at = NOW()
WHERE id = 'w3-d1-coming-hot';

UPDATE scanv_social_content SET caption = caption || E'\n\nOne App for everything.\nLocal community · Local support · Global happiness.'
WHERE is_daily_everywhere = TRUE
  AND caption NOT LIKE '%One App for everything%';

UPDATE scanv_social_content SET caption = REPLACE(
  REPLACE(caption, '10 cards. One app.', 'One App for everything. 10 services.'),
  'one app for local services', 'One App for everything — local community, local support, global happiness'
)
WHERE caption LIKE '%10 cards. One app.%' OR caption LIKE '%one app for local services%';
