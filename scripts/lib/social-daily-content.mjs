/**
 * Daily Instagram caption + image rotation for @scanvapp.
 * 14-day cycle — genz-week + prelaunch HOT themes.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const APP = process.env.APP_URL || 'https://getscanv.com';
const USER_URL = `${APP}?utm_source=instagram&utm_medium=daily_auto`;
const PARTNER_URL = `${APP}/#vendor-onboard?utm_source=instagram&utm_medium=daily_auto`;

const BRAND = `One App for everything.
Local community · Local support · Global happiness.`;

/** Public URLs — images live in public/social/ (served at getscanv.com/social/…) */
export const SOCIAL_IMAGES = {
  comingHot: '/social/coming-hot-post.png',
  profile: '/social/scanv-profile-picture.png',
  whatsappUncle: '/social/scanv-funny-insta-post-2026-08-19.png',
};

export const DAILY_POSTS = [
  {
    title: 'Launch — your mess our problem',
    image: SOCIAL_IMAGES.comingHot,
    caption: `Your mess. Our problem. 😉

${BRAND}

Verified waale · UPI on app · Pune & PCMC.

Register now 👇
${USER_URL}

#ScanV #Pune #PCMC #BookLocal #MainCharacterEnergy`,
  },
  {
    title: 'Deep clean',
    image: SOCIAL_IMAGES.comingHot,
    caption: `Deep clean so good you'll pretend you did it yourself. 💅

Wakad & PCMC — verified deep cleaning on ScanV. Bathroom, kitchen, full flat — book before the guests arrive.

9270194842 · link in bio
${USER_URL}

#ScanV #DeepCleaning #Wakad #PuneHome #NoCap`,
  },
  {
    title: 'How it works',
    image: SOCIAL_IMAGES.profile,
    caption: `Browse → Book → UPI → Track. That's the whole situationship. 📱

No "bhai rate kya" DMs. No cash under the mat. Just ScanV being responsible so you don't have to be.

4 steps. 0 drama. Infinite chill.

${USER_URL}
#ScanV #Pune #HowItWorks #UPI #Sorted`,
  },
  {
    title: 'PCMC coverage',
    image: SOCIAL_IMAGES.comingHot,
    caption: `Wakad · Hinjewadi · Baner · PCMC — we're building the partner network. Your area next? 👀

Local services shouldn't mean scrolling 47 WhatsApp forwards. One app. Verified waale. Pune vibes only.

Drop your area in comments — we'll take the hint.
${USER_URL}
#ScanV #PCMC #Hinjewadi #Baner #PuneLife`,
  },
  {
    title: 'Partner recruitment',
    image: SOCIAL_IMAGES.profile,
    caption: `Local vendor? Join ScanV — launch pe listing fee nahi. 😏

You bring the skills. We bring the bookings. Pune & PCMC customers ready.

Partner up 👇
${PARTNER_URL}
WhatsApp: 9270194842

#ScanV #PuneBusiness #VocalForLocal #VendorLife`,
  },
  {
    title: 'Trust',
    image: SOCIAL_IMAGES.profile,
    caption: `Verified partners only. OTP login. Secure UPI. 🔒

We keep it clean — in every sense. No random building uncle. No sketchy payment.

Trust issues? Same. That's why we built this.

${USER_URL}
#ScanV #Pune #Verified #SafeBooking #TrustTheProcess`,
  },
  {
    title: 'Week recap',
    image: SOCIAL_IMAGES.comingHot,
    caption: `Pune, ScanV is loading… ✨

Thank you for following before launch. More services coming — stay tuned.

Dhanyavad · Shukriya · Join waitlist 👇
${USER_URL}
#ScanV #Pune #PCMC #Week1 #ThankYou`,
  },
  {
    title: 'Coming HOT — dual register',
    image: SOCIAL_IMAGES.comingHot,
    caption: `Pune, I'm coming. HOT. 🔥

${BRAND}

Your mess. Our problem. 😉

Need a service? Register 👇
${USER_URL}

Got skills? Partner up 👇
${PARTNER_URL}`,
  },
  {
    title: 'User waitlist',
    image: SOCIAL_IMAGES.profile,
    caption: `Still saving random numbers in Notes app? 📱

${BRAND}

ScanV — cleaning, delivery, food, health & more. Launch first.

${USER_URL}
#ScanV #Pune #BookLocal`,
  },
  {
    title: 'Partner waitlist',
    image: SOCIAL_IMAGES.profile,
    caption: `Still taking bookings on 4 WhatsApp groups? 😭

ScanV for Pune & PCMC partners. Listing fee on launch: nahi 😏

${PARTNER_URL}
Questions: 9270194842
#ScanV #VendorLife #Pune`,
  },
  {
    title: '10 services',
    image: SOCIAL_IMAGES.comingHot,
    caption: `10 services. One App for everything. 🔥

${BRAND}

🧹 Household · 📦 Delivery · 🍱 Food · 🛵 2-Wheeler · 🚗 4-Wheeler
🏥 Health · 🏡 Property · ⚖️ Legal · 👑 VIP · ☁️ Cloud

User → ${USER_URL}
Partner → ${PARTNER_URL}`,
  },
  {
    title: 'Launch loading',
    image: SOCIAL_IMAGES.comingHot,
    caption: `Launch loading… ████████░░ 80%

Pune & PCMC — verified partners AND early users stacking up.
Don't be the one who finds out after your neighbour already booked.

Your mess. Our problem. 😉

${USER_URL}
#ScanV #Pune #ComingSoon`,
  },
  {
    title: 'Parents visiting',
    image: SOCIAL_IMAGES.comingHot,
    caption: `When your parents say "we're visiting tomorrow" — you shouldn't panic-clean at 2 AM. 👀

ScanV so Pune can book verified help in minutes.
Register now. Thank yourself later.

${USER_URL}
#ScanV #Pune #DeepCleaning`,
  },
  {
    title: 'WhatsApp uncle vs ScanV',
    image: SOCIAL_IMAGES.whatsappUncle,
    caption: `Pune madhe ekach farak: WhatsApp uncle vs ScanV app 💀

Uncle sends 47 forwards + "beta trust me".
You send one booking. Done.

${BRAND}

Need service? 👇 ${USER_URL}
Got skills? 👇 ${PARTNER_URL}

#ScanV #Pune #PCMC #MainCharacterEnergy #YourMessOurProblem`,
  },
];

/** Day index 0-based from a fixed epoch (2026-08-19 = day 0). */
export function dayIndex(date = new Date()) {
  const ist = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const epoch = new Date('2026-08-19T00:00:00+05:30');
  const ms = ist.setHours(0, 0, 0, 0) - epoch.getTime();
  return Math.floor(ms / 86400000);
}

export function getDailyPost(date = new Date()) {
  const idx = ((dayIndex(date) % DAILY_POSTS.length) + DAILY_POSTS.length) % DAILY_POSTS.length;
  const post = DAILY_POSTS[idx];
  return {
    ...post,
    dayIndex: idx,
    cycleDay: idx + 1,
    cycleLength: DAILY_POSTS.length,
  };
}

/** Optional: pull caption from admin social dashboard. */
export async function getDailyPostWithAdmin(adminHubPost) {
  try {
    const r = await adminHubPost('get_social_dashboard');
    const cap = r.today_everywhere?.caption;
    if (cap && String(cap).trim().length > 40) {
      const base = getDailyPost();
      return {
        ...base,
        caption: String(cap).trim(),
        source: 'admin_dashboard',
      };
    }
  } catch { /* offline or no pin */ }
  return { ...getDailyPost(), source: 'local_rotation' };
}

export function resolveImageUrl(relativePath, appUrl = APP) {
  const base = appUrl.replace(/\/$/, '');
  const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  return `${base}${path}`;
}
