#!/usr/bin/env node
/**
 * ScanV Pre-Launch Pulse — "I'm coming HOT" user + vendor waitlist content.
 * Run: node scripts/social_prelaunch.mjs
 * Use before launch to grow users AND partners.
 */
import { adminHubPost, APP_URL } from './lib/scanv-admin.mjs';
import { isOutreachWindowOpen, outsideHoursMessage, outreachWindowLabel } from './lib/business-hours.mjs';

const USER_URL = `${APP_URL}?utm_source=social&utm_medium=user_register`;
const PARTNER_URL = `${APP_URL}/#vendor-onboard?utm_source=social&utm_medium=partner_register`;

const BRAND = `One App for everything.
Local community · Local support · Global happiness.`;

const HOT_DAYS = [
  {
    title: 'I\'m coming HOT — dual register',
    caption: `Pune, I'm coming. HOT. 🔥

${BRAND}

🚀 Coming soon everywhere in Pune & PCMC.
Your mess. Our problem. 😉

Need a service? Register now 👇
${USER_URL}

Got skills? Join as partner 👇
${PARTNER_URL}`,
    focus: 'both',
  },
  {
    title: 'User waitlist — launch first',
    caption: `Still saving random numbers in Notes app? 📱

One App for everything — cleaning, delivery, food, health & more.
Local community · Local support · Global happiness.

ScanV is coming HOT. Open app → OTP → you're on the list. Launch first.

🚀 Coming soon everywhere in Pune & PCMC.
${USER_URL}`,
    focus: 'user',
  },
  {
    title: 'Partner waitlist — listing fee nahi',
    caption: `Still taking bookings on 4 WhatsApp groups? 😭

ScanV is coming HOT for Pune & PCMC partners.
Deep clean · delivery · food · mechanics · legal · more.
Listing fee on launch: nahi 😏

${PARTNER_URL}
Questions: 9270194842`,
    focus: 'partner',
  },
  {
    title: '10 services — dual CTA',
    caption: `10 services. One App for everything. I'm coming HOT. 🔥

${BRAND}

🧹 Household · 📦 Delivery · 🍱 Food · 🛵 2-Wheeler · 🚗 4-Wheeler
🏥 Health · 🏡 Property · ⚖️ Legal · 👑 VIP · ☁️ Cloud

Need one? Register as user.
Got one? Register as partner.
🚀 Coming soon everywhere in Pune & PCMC.

User → ${USER_URL}
Partner → ${PARTNER_URL}`,
    focus: 'both',
  },
  {
    title: 'Launch loading — countdown',
    caption: `Launch loading… ████████░░ 80%

Pune & PCMC — we're stacking verified partners AND early users.
Don't be the one who finds out after your neighbour already booked.

🚀 Coming soon everywhere in Pune & PCMC.
Your mess. Our problem. 😉

Users → ${USER_URL}
Partners → ${PARTNER_URL}`,
    focus: 'both',
  },
  {
    title: 'User emotional — parents visiting',
    caption: `When your parents say "we're visiting tomorrow" — you shouldn't panic-clean at 2 AM. 👀

ScanV is coming HOT so Pune can book verified help in minutes.
Register now. Thank yourself later.

🚀 Coming soon everywhere in Pune & PCMC.
${USER_URL}`,
    focus: 'user',
  },
  {
    title: 'Partner emotional — digital customers',
    caption: `Every local vendor deserves digital customers — without giant commissions.

ScanV is coming HOT. We're building the partner network NOW.
Join before launch. First movers get the first bookings.

${PARTNER_URL}
WhatsApp: 9270194842`,
    focus: 'partner',
  },
];

let dayOffset = 1;
let bundle = null;
try {
  const r = await adminHubPost('get_social_dashboard');
  dayOffset = r.config?.day_offset || 1;
  bundle = r.today_everywhere;
} catch {
  /* offline — use local rotation */
}

const calDay = ((dayOffset - 1) % 7) + 1;
const calWeek = Math.floor((dayOffset - 1) / 7) + 1;
const local = HOT_DAYS[(dayOffset - 1) % HOT_DAYS.length];

console.log('═══════════════════════════════════════════════════');
console.log('  SCANV PRE-LAUNCH — I\'M COMING HOT 🔥');
console.log('  Grow users + vendors BEFORE launch');
console.log('  ' + new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST');
console.log('  Week ' + calWeek + ' · Day ' + calDay + ' · Focus: ' + local.focus);
console.log('═══════════════════════════════════════════════════\n');

if (!isOutreachWindowOpen()) {
  console.log(outsideHoursMessage());
  console.log(`Post during ${outreachWindowLabel()}.\n`);
}

if (bundle?.caption && calWeek >= 3) {
  console.log('FROM ADMIN DASHBOARD (Week 3 prelaunch)\n');
  console.log('─'.repeat(50));
  console.log(bundle.caption);
  console.log('─'.repeat(50));
} else {
  console.log('TODAY CAPTION (copy → all 5 platforms)\n');
  console.log('─'.repeat(50));
  console.log(local.caption);
  console.log('─'.repeat(50));
}

console.log('\nPOST EVERYWHERE (when accounts exist)');
console.log('  1. Facebook + Instagram → https://business.facebook.com/');
console.log('  2. Threads              → https://www.threads.net/');
console.log('  3. YouTube + Shorts     → https://studio.youtube.com/');
console.log('  TikTok banned in India — use Reels\n');

console.log('REGISTER CTAs');
console.log('  Users:    ' + USER_URL);
console.log('  Partners: ' + PARTNER_URL);
console.log('  WhatsApp: 9270194842\n');

console.log('STORIES (daily pack)');
console.log('  1. "I\'m coming HOT 🔥" + logo');
console.log('  2. User link sticker');
console.log('  3. Partner link sticker');
console.log('  4. Poll: Need service / Provide service?\n');

console.log('PIN COMMENT');
console.log('  Need service? 👇 ' + USER_URL);
console.log('  Provide service? 👇 ' + PARTNER_URL + ' · 9270194842\n');

console.log('No accounts yet? → docs/social/prelaunch-first-posts.txt');
console.log('Full 14-day kit → docs/social/prelaunch-coming-hot.txt');
console.log('Dashboard → ' + APP_URL + '/#admin?tab=social');
console.log('═══════════════════════════════════════════════════\n');
