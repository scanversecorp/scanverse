#!/usr/bin/env node
/** Check which @scanvapp profiles exist (public HTTP). No login needed. */
import https from 'https';
import { readFileSync } from 'fs';

const config = JSON.parse(readFileSync(new URL('../docs/social/scanv-social-config.json', import.meta.url), 'utf8'));

function head(url) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: 'HEAD', timeout: 12000 }, (res) => {
      resolve({ url, status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 400 });
    });
    req.on('error', (e) => resolve({ url, status: 0, ok: false, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ url, status: 0, ok: false, error: 'timeout' }); });
    req.end();
  });
}

console.log('ScanV @scanvapp — account status\n');
for (const [name, p] of Object.entries(config.platforms)) {
  if (!p.target_url) continue;
  const r = await head(p.target_url);
  const india = p.available_in_india === false ? ' (N/A India)' : '';
  const flag = p.available_in_india === false ? '⏭ skip' : (r.ok ? '✓ live?' : '○ not found');
  console.log(`  ${flag}  ${name}${india}`);
  console.log(`       ${p.target_url} → HTTP ${r.status || r.error}`);
}
console.log('\nDaily post everywhere:', config.post_everywhere_daily.join(' · '));
console.log('Dashboard:', config.dashboard);
