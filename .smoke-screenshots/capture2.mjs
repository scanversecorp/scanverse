import { chromium } from 'playwright';
import path from 'path';

const BASE = 'https://getscanv.com';
const OUT = path.dirname(new URL(import.meta.url).pathname);

async function shot(page, name, waitMs = 1500) {
  await page.waitForTimeout(waitMs);
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`OK ${name}`);
  return file;
}

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({
  viewport: { width: 390, height: 844 },
  userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
})).newPage();

const results = [];

try {
  // Homepage
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  results.push(await shot(page, '01-homepage'));

  // Services tab -> Deliveries
  await page.locator('text=Services').first().click({ timeout: 8000 });
  await page.waitForTimeout(800);
  await page.locator('text=Delivery').first().click({ timeout: 8000 });
  results.push(await shot(page, '02-deliveries-browse'));

  // Click Same-Day Courier card
  await page.locator('text=Same-Day Courier').first().click({ timeout: 8000 });
  results.push(await shot(page, '03-service-detail'));

  // Book / Continue
  for (const label of ['Book now', 'Book', 'Continue', 'Proceed', 'Next']) {
    const btn = page.locator(`button:has-text("${label}")`).first();
    if (await btn.count() && await btn.isVisible().catch(() => false)) {
      await btn.click({ timeout: 5000 });
      results.push(await shot(page, '04-booking-form'));
      break;
    }
  }

  // Try food flow via home search or categories
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.locator('text=Services').first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(600);
  const food = page.locator('text=/Food|Kitchen|Tiffin/i').first();
  if (await food.count()) {
    await food.click({ timeout: 5000 });
    results.push(await shot(page, '09-food-browse'));
  }

  // Bookings tab
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.locator('text=Bookings').first().click({ timeout: 8000 });
  results.push(await shot(page, '10-bookings-tab'));

  // Track hash
  await page.goto(`${BASE}/#track`, { waitUntil: 'networkidle', timeout: 30000 });
  results.push(await shot(page, '06-track', 2500));

  // Exec + Admin PIN gates
  for (const [hash, name] of [['exec', '07-exec-pin-gate'], ['admin', '08-admin-pin-gate']]) {
    await page.goto(`${BASE}/#${hash}`, { waitUntil: 'networkidle', timeout: 30000 });
    results.push(await shot(page, name, 2000));
  }

  console.log('DONE', results.length, 'screenshots');
} catch (e) {
  console.error('ERROR', e.message);
  await shot(page, 'error-state', 500);
} finally {
  await browser.close();
}
