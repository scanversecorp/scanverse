import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import path from 'path';

const OUT = path.dirname(new URL(import.meta.url).pathname);
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const urls = [
  'https://console.twilio.com/',
  'https://www.twilio.com/login',
  'https://1console.twilio.com/',
];

const report = { checkedAt: new Date().toISOString(), pages: [] };

for (const url of urls) {
  try {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(3000);
    const finalUrl = page.url();
    const title = await page.title();
    const bodyText = (await page.locator('body').innerText()).slice(0, 4000);
    const shot = path.join(OUT, `twilio-${report.pages.length + 1}.png`);
    await page.screenshot({ path: shot, fullPage: false });
    report.pages.push({
      startUrl: url,
      finalUrl,
      title,
      status: res?.status(),
      screenshot: shot,
      textSample: bodyText.replace(/\s+/g, ' ').slice(0, 1500),
    });
  } catch (err) {
    report.pages.push({ startUrl: url, error: String(err) });
  }
}

console.log(JSON.stringify(report, null, 2));
await browser.close();
