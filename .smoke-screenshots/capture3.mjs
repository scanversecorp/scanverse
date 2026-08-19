import { chromium } from 'playwright';
import path from 'path';

const BASE = 'https://getscanv.com';
const OUT = path.dirname(new URL(import.meta.url).pathname);

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({
  viewport: { width: 390, height: 844 },
  userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
})).newPage();

try {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.locator('text=Services').first().click();
  await page.locator('text=Delivery').first().click();
  await page.locator('text=Same-Day Courier').first().click();
  await page.locator('button:has-text("Book now")').first().click();
  await page.waitForTimeout(1000);

  // Accept terms
  const terms = page.locator('input[type="checkbox"]').first();
  if (await terms.count()) await terms.check({ force: true });

  // Click Send SMS OTP (will fail without real OTP but may show next UI)
  const sendOtp = page.locator('button:has-text("Send SMS OTP")').first();
  if (await sendOtp.isEnabled().catch(() => false)) {
    await sendOtp.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(OUT, '05-after-otp-request.png') });
    console.log('OK 05-after-otp-request');
  } else {
    await page.screenshot({ path: path.join(OUT, '05-otp-blocked-terms.png') });
    console.log('OK 05-otp-blocked (button disabled)');
  }

  // Try #track with sample id
  await page.goto(`${BASE}/#track?id=TEST123`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT, '06-track-with-id.png') });
  console.log('OK 06-track-with-id');
} catch (e) {
  console.error('ERROR', e.message);
} finally {
  await browser.close();
}
