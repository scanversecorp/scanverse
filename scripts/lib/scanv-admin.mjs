/** Shared admin-hub client for ScanV ops scripts. */
import { readFileSync } from 'fs';
import https from 'https';

export function loadDotEnv() {
  try {
    const raw = readFileSync(new URL('../../.env', import.meta.url), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m || process.env[m[1]]) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  } catch { /* no .env */ }
}

loadDotEnv();

export const SB_URL = process.env.SCANV_SB_URL || process.env.SB_URL || 'https://rwlwrmmqtedugcreweut.supabase.co';
export const SB_KEY = process.env.SCANV_SB_KEY || process.env.SB_KEY || 'sb_publishable_sx3krTi2ijpvn-K8wAQP6w_VFwH0vR3';
export const ADMIN_PIN = process.env.ADMIN_HUB_PIN || process.env.SUPPORT_ADMIN_PIN || process.env.ADMIN_PIN || '';
export const APP_URL = process.env.APP_URL || 'https://getscanv.com';

export function adminHubPost(action, payload = {}) {
  if (!ADMIN_PIN) throw new Error('Set ADMIN_HUB_PIN, SUPPORT_ADMIN_PIN, or ADMIN_PIN in .env');
  const body = JSON.stringify({ action, ...payload });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: SB_URL.replace('https://', '').split('/')[0],
      path: '/functions/v1/admin-hub',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        'x-admin-pin': ADMIN_PIN,
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let b = '';
      res.on('data', (c) => { b += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(b)); } catch { resolve({ raw: b, status: res.statusCode }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export function phoneDigits(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (!d) return '';
  return d.startsWith('91') ? d : `91${d}`;
}

export function whatsAppUrl(phone, text) {
  const d = phoneDigits(phone);
  if (!d) return null;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}
