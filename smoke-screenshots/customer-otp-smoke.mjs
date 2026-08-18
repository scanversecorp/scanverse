import { chromium } from 'playwright';
import path from 'path';
import { mkdir } from 'fs/promises';

const BASE = 'https://getscanv.com';
const MOBILE = '9270194842';
const OUT = path.dirname(new URL(import.meta.url).pathname);
const HEADED = process.env.HEADED !== '0';

async function shot(page, name, waitMs = 1500) {
  await page.waitForTimeout(waitMs);
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`SCREENSHOT ${name} -> ${file}`);
  return file;
}

async function acceptTermsIfNeeded(page) {
  const cb = page.locator('input[type="checkbox"]').first();
  if (await cb.count() && (await cb.isVisible().catch(() => false))) {
    await cb.click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
    console.log('Accepted terms checkbox');
  }
  const homeTerms = page.locator('button:has-text("Accept"), button:has-text("Continue"), button:has-text("I agree")').first();
  if (await homeTerms.count() && (await homeTerms.isVisible().catch(() => false))) {
    await homeTerms.click().catch(() => {});
    await page.waitForTimeout(500);
    console.log('Accepted home terms gate');
  }
}

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: !HEADED, slowMo: HEADED ? 300 : 0 });
const page = await (await browser.newContext({
  viewport: { width: 390, height: 844 },
  userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
})).newPage();

const log = [];
let blockedAt = null;

try {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 90000 });
  log.push({ step: '01-homepage', file: await shot(page, 'prod-01-homepage') });

  await acceptTermsIfNeeded(page);
  log.push({ step: '02-after-terms', file: await shot(page, 'prod-02-after-terms') });

  // Services tab
  const servicesTab = page.locator('text=Services').first();
  if (await servicesTab.count()) {
    await servicesTab.click({ timeout: 10000 });
    await page.waitForTimeout(800);
  }

  // Pick Deliveries or Food
  let categoryClicked = false;
  for (const label of ['Delivery', 'Deliveries', 'Food']) {
    const cat = page.locator(`text=${label}`).first();
    if (await cat.count() && (await cat.isVisible().catch(() => false))) {
      await cat.click({ timeout: 10000 });
      categoryClicked = true;
      console.log(`Selected category: ${label}`);
      break;
    }
  }
  if (!categoryClicked) {
    blockedAt = 'Could not find Deliveries/Food category on Services tab';
  }
  log.push({ step: '03-category', file: await shot(page, 'prod-03-category'), blockedAt });

  // Click first service card
  if (!blockedAt) {
    const serviceNames = ['Same-Day Courier', 'Grocery', 'Parcel', 'Office Lunch', 'Restaurant'];
    let serviceClicked = false;
    for (const name of serviceNames) {
      const svc = page.locator(`text=${name}`).first();
      if (await svc.count() && (await svc.isVisible().catch(() => false))) {
        await svc.click({ timeout: 10000 });
        serviceClicked = true;
        console.log(`Selected service: ${name}`);
        break;
      }
    }
    if (!serviceClicked) {
      const bookCard = page.locator('button, a, [role="button"]').filter({ hasText: /book|order|from ₹|₹/i }).first();
      if (await bookCard.count()) {
        await bookCard.click({ timeout: 10000 });
        serviceClicked = true;
      }
    }
    if (!serviceClicked) blockedAt = 'Could not click a service card';
  }
  log.push({ step: '04-service-detail', file: await shot(page, 'prod-04-service-detail'), blockedAt });

  // Book now
  if (!blockedAt) {
    const bookNow = page.locator('button:has-text("Book now")').first();
    if (await bookNow.count()) {
      await bookNow.click({ timeout: 10000 });
      await page.waitForTimeout(1000);
    } else {
      blockedAt = 'Book now button not found on service detail';
    }
  }
  log.push({ step: '05-verify-form', file: await shot(page, 'prod-05-verify-form'), blockedAt });

  if (!blockedAt) {
    await page.locator('input[placeholder="Rahul"]').first().fill('ScanV');
    await page.locator('input[placeholder="Sharma"]').first().fill('Smoke');
    const mobileInput = page.locator('input[placeholder="9876543210"]').first();
    await mobileInput.fill(MOBILE);
    await page.locator('input[placeholder*="Flat" i], input[placeholder*="Rose" i], input[placeholder*="House" i]').first().fill('Flat 101, Test Society, Wakad');
    await page.locator('input[placeholder="Your city"], input[placeholder="Pune"]').first().fill('Pune');
    await page.locator('input[placeholder="411018"], input[placeholder="411057"]').first().fill('411057');

    await acceptTermsIfNeeded(page);
    log.push({ step: '06-form-filled', file: await shot(page, 'prod-06-form-filled') });

    const smsTab = page.locator('button:has-text("SMS OTP")').first();
    if (await smsTab.count()) await smsTab.click().catch(() => {});

    const sendOtp = page.locator('button:has-text("Send SMS OTP")').first();
    if (!(await sendOtp.count())) {
      blockedAt = 'Send SMS OTP button not found';
    } else if (!(await sendOtp.isEnabled())) {
      blockedAt = 'Send SMS OTP button disabled (terms or validation)';
      log.push({ step: '07-otp-blocked', file: await shot(page, 'prod-07-otp-blocked'), blockedAt });
    } else {
      await sendOtp.click({ timeout: 15000 });
      await page.waitForTimeout(4000);
      const otpInputs = page.locator('[id^="votp-"]');
      const otpSent = (await otpInputs.count()) > 0 || (await page.locator('text=/OTP sent|Enter OTP|6-digit/i').count()) > 0;
      log.push({
        step: otpSent ? '07-otp-sent' : '07-after-otp-click',
        file: await shot(page, otpSent ? 'prod-07-otp-sent' : 'prod-07-after-otp-click', 2000),
        otpSent,
        mobile: `+91 ${MOBILE}`,
      });
      if (!otpSent) blockedAt = 'Clicked Send SMS OTP but OTP entry UI did not appear';
    }
  }

  console.log('RESULT', JSON.stringify({ blockedAt, log, message: blockedAt ? `BLOCKED: ${blockedAt}` : `OTP sent to +91 ${MOBILE} — user paste code in chat` }, null, 2));
} catch (e) {
  await shot(page, 'prod-error', 500).catch(() => {});
  console.error('ERROR', e.message);
  process.exitCode = 1;
} finally {
  if (HEADED) {
    console.log('Browser left open 30s for visual inspection…');
    await page.waitForTimeout(30000);
  }
  await browser.close();
}
