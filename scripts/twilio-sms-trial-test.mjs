#!/usr/bin/env node
/** Twilio SMS trial — navigate console, start trial, send test SMS */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, 'docs/social');
const CREDS = join(OUT, 'credentials.env');
const TEST_PHONE = '+919270194842';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const report = {
  at: new Date().toISOString(),
  trialNumber: null,
  testSmsSent: false,
  accountSid: null,
  authToken: null,
  errors: [],
  steps: [],
};

async function bodyText(page) {
  return (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
}

async function clickByText(page, patterns) {
  for (const pat of patterns) {
    const btn = page.getByRole('button', { name: pat }).first();
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click();
      return pat.toString();
    }
    const link = page.getByRole('link', { name: pat }).first();
    if (await link.isVisible({ timeout: 1000 }).catch(() => false)) {
      await link.click();
      return pat.toString();
    }
  }
  return null;
}

function parseCredentials(text) {
  const sid = text.match(/AC[a-f0-9]{32}/i)?.[0] || null;
  const phones = [...text.matchAll(/\+1[\d\s()-]{10,}/g)].map((m) => m[0].replace(/\s/g, ''));
  return { sid, phones: [...new Set(phones)] };
}

function saveCredentials({ sid, fromNumber }) {
  let content = existsSync(CREDS) ? readFileSync(CREDS, 'utf8') : '';
  const set = (key, val) => {
    if (!val) return;
    const re = new RegExp(`^${key}=.*$`, 'm');
    content = re.test(content) ? content.replace(re, `${key}=${val}`) : `${content.trim()}\n${key}=${val}\n`;
  };
  set('TWILIO_ACCOUNT_SID', sid);
  if (fromNumber) {
    set('TWILIO_SMS_FROM', fromNumber);
    set('TWILIO_VOICE_FROM', fromNumber);
    set('TWILIO_PHONE_NUMBER', fromNumber);
  }
  writeFileSync(CREDS, content.endsWith('\n') ? content : `${content}\n`);
}

async function trySendTestSms(page) {
  await page.goto('https://console.twilio.com/us1/develop/sms/try-it-out/send-an-sms', {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  }).catch((e) => report.errors.push(`sms-page: ${e.message}`));
  await sleep(5000);

  const toInput = page.locator('input[name*="To"], input[placeholder*="To"], input[id*="to"], input[aria-label*="To"]').first();
  const msgInput = page.locator('textarea, input[name*="Body"], input[placeholder*="message"]').first();

  if (await toInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await toInput.fill(TEST_PHONE);
    if (await msgInput.isVisible().catch(() => false)) {
      await msgInput.fill('ScanV Twilio SMS trial test — ignore.');
    }
    const sent = await clickByText(page, [/Send SMS/i, /Send message/i, /^Send$/i]);
    if (sent) {
      await sleep(6000);
      const txt = await bodyText(page);
      report.testSmsSent = /sent|success|delivered|queued/i.test(txt);
      report.steps.push(`send-sms: ${sent}, ok=${report.testSmsSent}`);
    }
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const chromeProfile = join(process.env.HOME, 'Library/Application Support/Google/Chrome');

  let browser;
  try {
    browser = await chromium.launchPersistentContext(chromeProfile, {
      channel: 'chrome',
      headless: true,
      args: ['--profile-directory=Default', '--disable-blink-features=AutomationControlled'],
      viewport: { width: 1280, height: 900 },
      ignoreHTTPSErrors: true,
    });
  } catch (e) {
    report.errors.push(`chrome-profile: ${e.message}`);
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    browser = ctx;
  }

  const page = browser.pages()[0] || (await browser.newPage());

  try {
    await page.goto('https://console.twilio.com/', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await sleep(6000);
    report.steps.push(`home: ${page.url()}`);
    await page.screenshot({ path: join(OUT, 'twilio-trial-01-home.png') }).catch(() => {});

    let text = await bodyText(page);
    if (/email address|welcome|log in|sign in/i.test(text) && !/account home|start sms trial|my first twilio/i.test(text)) {
      report.errors.push('Not logged in — Twilio login page shown');
      writeFileSync(join(OUT, 'twilio-trial-report.json'), JSON.stringify(report, null, 2));
      console.log(JSON.stringify(report, null, 2));
      await browser.close().catch(() => {});
      process.exit(1);
    }

    const startTrial = await clickByText(page, [/Start SMS trial/i, /Try SMS/i, /Start trial/i]);
    if (startTrial) {
      report.steps.push(`clicked: ${startTrial}`);
      await sleep(5000);
    }

    text = await bodyText(page);
    let parsed = parseCredentials(text);
    if (parsed.phones[0]) report.trialNumber = parsed.phones[0];
    if (parsed.sid) report.accountSid = parsed.sid;

    await clickByText(page, [/Next/i, /Continue/i, /Get started/i, /Try it out/i]);
    await sleep(4000);

    text = await bodyText(page);
    parsed = parseCredentials(text);
    if (parsed.phones[0]) report.trialNumber = parsed.phones[0];
    if (parsed.sid) report.accountSid = parsed.sid;

    await page.goto('https://console.twilio.com/us1/account/keys-credentials/api-keys', {
      waitUntil: 'domcontentloaded',
      timeout: 90000,
    }).catch(() => {});
    await sleep(4000);
    text = await bodyText(page);
    parsed = parseCredentials(text);
    if (parsed.sid) report.accountSid = parsed.sid;

    await trySendTestSms(page);
    await page.screenshot({ path: join(OUT, 'twilio-trial-02-sms.png') }).catch(() => {});

    text = await bodyText(page);
    parsed = parseCredentials(text);
    if (parsed.phones[0] && !report.trialNumber) report.trialNumber = parsed.phones[0];

    if (report.accountSid || report.trialNumber) {
      saveCredentials({ sid: report.accountSid, fromNumber: report.trialNumber });
    }
  } catch (e) {
    report.errors.push(String(e.message || e));
  }

  writeFileSync(join(OUT, 'twilio-trial-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close().catch(() => {});
}

main().catch((e) => {
  report.errors.push(String(e));
  writeFileSync(join(OUT, 'twilio-trial-report.json'), JSON.stringify(report, null, 2));
  console.error(e);
  process.exit(1);
});
