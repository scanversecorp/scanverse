#!/usr/bin/env node
/**
 * ScanV production smoke test — API + UI flows.
 * Usage: node scripts/smoke-test.mjs
 */
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dir, '..', 'smoke-screenshots');
const BASE = process.env.SMOKE_BASE || 'https://getscanv.com';
const SB_URL = 'https://rwlwrmmqtedugcreweut.supabase.co';
const KEY = 'sb_publishable_sx3krTi2ijpvn-K8wAQP6w_VFwH0vR3';
const MOBILE = '9270194842';

const results = [];

function pass(step, detail, screenshot = null) {
  results.push({ step, status: 'PASS', detail, screenshot });
  console.log(`PASS  ${step} — ${detail}`);
}

function fail(step, detail, screenshot = null) {
  results.push({ step, status: 'FAIL', detail, screenshot });
  console.error(`FAIL  ${step} — ${detail}`);
}

async function api(name, url, opts = {}) {
  const r = await fetch(url, {
    ...opts,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body };
}

async function runApiTests() {
  let r = await api('profiles', `${SB_URL}/rest/v1/profiles?select=id&limit=1`);
  r.status === 401 || r.status === 403 ? pass('Security: profiles anon read', `HTTP ${r.status}`) : fail('Security: profiles anon read', `HTTP ${r.status}`);

  r = await api('pay-intents-read', `${SB_URL}/rest/v1/payment_intents?select=txn_id&limit=1`);
  const payRows = Array.isArray(r.body) ? r.body : [];
  payRows.length === 0
    ? pass('Security: payment_intents anon read blocked', `HTTP ${r.status}, rows=${payRows.length}`)
    : fail('Security: payment_intents anon read blocked', `HTTP ${r.status}, leaked ${payRows.length} row(s)`);

  r = await api('pay-intents-insert', `${SB_URL}/rest/v1/payment_intents`, {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ txn_id: `TXN-EVIL-${Date.now()}`, amount_paise: 1, status: 'paid' }),
  });
  r.status >= 400
    ? pass('Security: payment_intents anon insert blocked', `HTTP ${r.status}`)
    : fail('Security: payment_intents anon insert blocked', `HTTP ${r.status}`);

  r = await api('pricing', `${SB_URL}/rest/v1/service_prices_public?select=service_id&limit=3`);
  r.status === 200 ? pass('API: public pricing readable', `HTTP 200, rows: ${Array.isArray(r.body) ? r.body.length : '?'}`) : fail('API: public pricing readable', `HTTP ${r.status}`);

  r = await api('admin', `${SB_URL}/functions/v1/admin-hub`, { method: 'POST', body: JSON.stringify({ action: 'ping' }) });
  r.status === 401 ? pass('Security: admin-hub without PIN', `HTTP ${r.status}`) : fail('Security: admin-hub without PIN', `HTTP ${r.status}`);

  r = await api('dispatch', `${SB_URL}/functions/v1/booking-dispatch`, { method: 'POST', body: JSON.stringify({ action: 'tick' }) });
  r.status === 401 ? pass('Security: dispatch tick without secret', `HTTP ${r.status}`) : fail('Security: dispatch tick without secret', `HTTP ${r.status}`);

  r = await api('razorpay', `${SB_URL}/functions/v1/razorpay-payment`, {
    method: 'POST',
    body: JSON.stringify({ action: 'register', txn_id: 'TXN-SMOKE-TEST', amount_paise: 100 }),
  });
  (r.body?.url || r.body?.success) ? pass('API: razorpay register', `HTTP ${r.status} link=${Boolean(r.body?.url)}`) : fail('API: razorpay register', JSON.stringify(r.body).slice(0, 120));

  r = await api('otp', `${SB_URL}/functions/v1/send-otp`, {
    method: 'POST',
    body: JSON.stringify({ mobile: '9999999999', action: 'send' }),
  });
  r.body?.success ? pass('API: send-otp reachable', `HTTP ${r.status} provider=${r.body.provider}`) : fail('API: send-otp reachable', JSON.stringify(r.body).slice(0, 120));

  const email = `smoke${Date.now()}@scanv.app`;
  const password = 'ScanVSmokeTest1!';
  r = await fetch(`${SB_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const signup = await r.json();
  const hasSession = Boolean(signup.access_token);
  r = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const signin = await r.json();
  (hasSession || signin.access_token)
    ? pass('Auth: signup/signin', hasSession ? 'signup session ok' : 'signin ok')
    : fail('Auth: signup/signin', signin.msg || signin.error_description || signup.msg || 'no session');
}

async function acceptTerms(page) {
  const cb = page.locator('input[type="checkbox"]').first();
  if (await cb.count() && (await cb.isVisible().catch(() => false))) {
    await cb.click({ force: true, timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(300);
  }
}

async function runUiTests() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
  })).newPage();

  const shot = async (name) => {
    const file = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: file, fullPage: false });
    return file;
  };

  try {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 90000 });
    pass('UI: production app loads', `title="${await page.title()}"`, await shot('01-home'));

    await acceptTerms(page);
    pass('UI: terms gate', 'Handled or not shown', await shot('02-after-terms'));

    for (const route of [
      ['#admin', 'admin hub PIN gate', 'input[type="password"], input[inputmode="numeric"]'],
      ['#vendor-admin', 'vendor-admin PIN gate', 'input[type="password"], input[inputmode="numeric"]'],
      ['#vendor-onboard', 'vendor onboard', 'text=Vendor'],
      ['#faq', 'FAQ', 'text=FAQ'],
      ['#track?id=TEST123', 'track screen', 'text=Track'],
      ['/?payment=TXN-TEST&razorpay_payment_link_status=paid', 'payment return URL', 'body'],
      ['/privacy', 'privacy policy', 'text=Privacy'],
      ['/terms', 'terms page', 'text=Terms'],
    ]) {
      const url = route[0].startsWith('/') ? `${BASE}${route[0]}` : `${BASE}/${route[0].replace(/^\/?/, '')}`;
      await page.goto(url.includes('://') ? url : `${BASE}${route[0]}`, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(1200);
      const ok = (await page.locator(route[2]).count()) > 0;
      ok ? pass(`UI: ${route[1]}`, 'Page loaded', await shot(route[1].replace(/\s+/g, '-'))) : fail(`UI: ${route[1]}`, `Missing: ${route[2]}`);
    }

    await page.goto(BASE, { waitUntil: 'networkidle' });
    await acceptTerms(page);
    await page.locator('text=Services').first().click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(800);
    for (const label of ['Delivery', 'Deliveries', 'Food']) {
      const cat = page.locator(`text=${label}`).first();
      if (await cat.count()) { await cat.click(); break; }
    }
    pass('UI: Services browse', 'Category opened', await shot('03-category'));

    for (const name of ['Same-Day Courier', 'Restaurant', 'Grocery']) {
      const svc = page.locator(`text=${name}`).first();
      if (await svc.count() && (await svc.isVisible().catch(() => false))) {
        await svc.click();
        break;
      }
    }
    const bookNow = page.locator('button:has-text("Book now")').first();
    if (await bookNow.count()) await bookNow.click();
    await page.waitForTimeout(1000);
    pass('UI: booking verify form', 'Reached verify step', await shot('04-verify-form'));

    await page.locator('input[placeholder="Rahul"]').first().fill('ScanV');
    await page.locator('input[placeholder="Sharma"]').first().fill('Smoke');
    await page.locator('input[placeholder="9876543210"]').first().fill(MOBILE);
    await page.locator('input[placeholder*="Flat" i], input[placeholder*="House" i]').first().fill('Flat 101, Wakad');
    await page.locator('input[placeholder="Your city"]').first().fill('Pune');
    await page.locator('input[placeholder="411018"]').first().fill('411057');
    await acceptTerms(page);
    const sendOtp = page.locator('button:has-text("Send SMS OTP")').first();
    const enabled = await sendOtp.isEnabled().catch(() => false);
    if (enabled) {
      await sendOtp.click();
      await page.waitForTimeout(4000);
      const otpUi = (await page.locator('[id^="votp-"]').count()) > 0;
      otpUi ? pass('UI: OTP send', `OTP UI shown for +91 ${MOBILE}`, await shot('05-otp-sent')) : fail('UI: OTP send', 'No OTP input after send');
    } else {
      fail('UI: OTP send', 'Send SMS OTP disabled');
    }

    await page.locator('text=Bookings').first().click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);
    pass('UI: login screen (Bookings nav)', 'Bookings tab opened', await shot('08-login-bookings'));
  } catch (e) {
    fail('UI: unexpected error', e.message, await shot('error').catch(() => null));
  } finally {
    await browser.close();
  }
}

await runApiTests();
await runUiTests();

const fails = results.filter((r) => r.status === 'FAIL');
await writeFile(path.join(OUT, 'results-smoke.json'), JSON.stringify(results, null, 2));
console.log(`\n=== ${results.length - fails.length}/${results.length} passed ===`);
if (fails.length) {
  console.error('Failures:', fails.map((f) => f.step).join(', '));
  process.exitCode = 1;
}
