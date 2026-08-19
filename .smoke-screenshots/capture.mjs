import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import path from 'path';

const BASE = 'https://getscanv.com';
const OUT = path.dirname(new URL(import.meta.url).pathname);

async function shot(page, name, waitMs = 1500) {
  await page.waitForTimeout(waitMs);
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`OK ${name} -> ${file}`);
  return file;
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
});
const page = await context.newPage();

const results = [];

try {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  results.push(await shot(page, '01-homepage'));

  // Try to find and click a service (delivery or food)
  const serviceSelectors = [
    'text=Delivery',
    'text=Food',
    'text=Parcel',
    'text=Grocery',
    '[data-testid*="service"]',
    'button:has-text("Book")',
  ];
  let clicked = false;
  for (const sel of serviceSelectors) {
    const el = page.locator(sel).first();
    if (await el.count() > 0 && await el.isVisible().catch(() => false)) {
      await el.click({ timeout: 5000 }).catch(() => {});
      clicked = true;
      console.log(`Clicked service via: ${sel}`);
      break;
    }
  }
  if (!clicked) {
    // click first card-like button
    const cards = page.locator('button, a, [role="button"]').filter({ hasText: /.+/ });
    const n = await cards.count();
    for (let i = 0; i < Math.min(n, 15); i++) {
      const t = (await cards.nth(i).innerText().catch(() => '')).trim();
      if (/delivery|food|parcel|grocery|book|order/i.test(t)) {
        await cards.nth(i).click().catch(() => {});
        clicked = true;
        console.log(`Clicked card: ${t.slice(0, 40)}`);
        break;
      }
    }
  }
  results.push(await shot(page, '02-service-selected'));

  // Fill booking form if visible
  const inputs = page.locator('input, textarea, select');
  const inputCount = await inputs.count();
  console.log(`Inputs found: ${inputCount}`);
  if (inputCount > 0) {
    const nameInput = page.locator('input[placeholder*="name" i], input[name*="name" i]').first();
    const phoneInput = page.locator('input[type="tel"], input[placeholder*="mobile" i], input[placeholder*="phone" i]').first();
    const addrInput = page.locator('input[placeholder*="address" i], textarea[placeholder*="address" i]').first();
    if (await nameInput.count()) await nameInput.fill('Smoke Test User').catch(() => {});
    if (await phoneInput.count()) await phoneInput.fill('9876543210').catch(() => {});
    if (await addrInput.count()) await addrInput.fill('PCMC Pune Test Address').catch(() => {});
    results.push(await shot(page, '03-booking-form-filled'));

    const continueBtn = page.locator('button:has-text("Continue"), button:has-text("Next"), button:has-text("Proceed"), button:has-text("Book"), button:has-text("Pay")').first();
    if (await continueBtn.count()) {
      await continueBtn.click({ timeout: 5000 }).catch(() => {});
      results.push(await shot(page, '04-after-continue'));
    }
  }

  // Payment screen
  const payVisible = await page.locator('text=/UPI|Pay|Payment|₹/').first().isVisible().catch(() => false);
  if (payVisible) results.push(await shot(page, '05-payment-screen'));

  // Hash routes
  for (const [hash, name] of [
    ['track', '06-track'],
    ['exec', '07-exec-pin-gate'],
    ['admin', '08-admin-pin-gate'],
  ]) {
    await page.goto(`${BASE}/#${hash}`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    results.push(await shot(page, name, 2000));
  }

  console.log('SCREENSHOTS:', JSON.stringify(results, null, 2));
} catch (e) {
  console.error('ERROR', e.message);
  await page.screenshot({ path: path.join(OUT, 'error.png') }).catch(() => {});
} finally {
  await browser.close();
}
