#!/usr/bin/env node
/** Print today's service ad + user/partner register CTAs. */
import { adminHubPost, APP_URL } from './lib/scanv-admin.mjs';

const USER_URL = `${APP_URL}?utm_source=social&utm_medium=user_register`;
const PARTNER_URL = `${APP_URL}/#vendor-onboard?utm_source=social&utm_medium=partner_register`;

const SERVICES = [
  { icon: '🧹', name: 'Household', hook: '🚀 COMING SOON — Flat messy? Deep clean + home help on ScanV. Your mess. Our problem. 😉' },
  { icon: '📦', name: 'Delivery', hook: 'Pickup, drop, same-day — stop begging courier bhaiya on WhatsApp.' },
  { icon: '🍱', name: 'Food', hook: 'Tiffin, restaurants, catering — hunger is urgent. ScanV gets it.' },
  { icon: '🛵', name: 'Two Wheeler', hook: 'Bike broke? Mechanic, battery, towing — book verified help.' },
  { icon: '🚗', name: 'Four Wheeler', hook: 'Car service, pick-up/drop, wash — your car, our care.' },
  { icon: '🏥', name: 'Health', hook: 'Doctor home visit, lab tests, pharmacy — care without queue trauma.' },
  { icon: '🏡', name: 'Property', hook: 'Buy, rent, verify — find home, find peace.' },
  { icon: '⚖️', name: 'Legal', hook: 'Lawyers & docs — legal problems need pros, not Twitter advice.' },
  { icon: '👑', name: 'VIP', hook: 'Concierge, travel, events — main character energy only.' },
  { icon: '☁️', name: 'Cloud', hook: 'Hosting, managed IT, data center — scale without losing sleep.' },
];

let dayOffset = 1;
try {
  const r = await adminHubPost('get_social_dashboard');
  dayOffset = r.config?.day_offset || 1;
} catch { /* use default */ }

const calDay = ((dayOffset - 1) % 7) + 1;
const calWeek = Math.floor((dayOffset - 1) / 7) + 1;
const svc = SERVICES[(dayOffset - 1) % SERVICES.length];

console.log('══════════════════════════════════════════');
console.log('  SCANV SERVICES AD CAMPAIGN');
console.log('  Week', calWeek, '· Day', calDay, '· Spotlight:', svc.icon, svc.name);
console.log('══════════════════════════════════════════\n');

console.log('TODAY SERVICE AD (post everywhere)\n');
console.log(svc.hook);
console.log('\n10 services · one app · 🚀 COMING SOON to Pune & PCMC');
console.log(USER_URL);
console.log('\n#ScanV #Pune #PCMC #' + svc.name.replace(/\s/g, ''));

console.log('\n--- REGISTER AS USER ---\n');
console.log('Open ScanV → pick service → OTP → join waitlist. Launch first.');
console.log(USER_URL);

console.log('\n--- REGISTER AS SERVICE PROVIDER ---\n');
console.log('Got skills? Join ScanV waitlist — listing fee nahi on launch 😏');
console.log(PARTNER_URL);
console.log('WhatsApp: 9270194842');

if (calDay === 6) console.log('\n*** USER CTA DAY — see genz-register-ads.txt ***');
if (calDay === 7) console.log('\n*** PARTNER CTA DAY — see genz-register-ads.txt ***');

console.log('\nFull kit: docs/social/ad-campaign-all-services.txt');
console.log('Dashboard: ' + APP_URL + '/#admin?tab=social\n');
