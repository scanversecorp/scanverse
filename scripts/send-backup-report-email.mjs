#!/usr/bin/env node
/**
 * Send backup report email via health-report edge function.
 *
 * Auth (first match):
 *   HEALTH_REPORT_SECRET env → x-health-report-secret header
 *   Supabase service_role JWT from CLI
 *
 *   node scripts/send-backup-report-email.mjs
 *   node scripts/send-backup-report-email.mjs --to=scanversecorp@gmail.com
 */
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const toArg = process.argv.find((a) => a.startsWith('--to='));
const to = toArg ? toArg.split('=')[1] : 'scanversecorp@gmail.com';
const healthUrl = process.env.HEALTH_REPORT_URL
  || 'https://rwlwrmmqtedugcreweut.supabase.co/functions/v1/health-report';

function getLegacyServiceRole() {
  try {
    const raw = execSync(
      'npx supabase projects api-keys --project-ref rwlwrmmqtedugcreweut -o json',
      { encoding: 'utf8', cwd: root, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    const keys = JSON.parse(raw);
    return (Array.isArray(keys) ? keys : []).find((k) => k.name === 'service_role')?.api_key || '';
  } catch {
    return '';
  }
}

const doc = readFileSync(path.join(root, 'docs/BACKUP-20260822-GOLIVE.md'), 'utf8');
const subject = 'ScanV Full Backup — Go-Live Baseline (22 Aug 2026)';
const body = [
  'ScanV Full Backup — Go-Live Baseline (22 Aug 2026)',
  '===================================================',
  '',
  `Sent to: ${to}`,
  `Doc file: docs/BACKUP-20260822-GOLIVE.md`,
  '',
  doc.replace(/^#.*$/m, '').trim(),
  '',
  '— ScanV automated backup report',
].join('\n');

const headers = { 'Content-Type': 'application/json' };
const cronSecret = process.env.HEALTH_REPORT_SECRET || '';
if (cronSecret.length >= 8) {
  headers['x-health-report-secret'] = cronSecret;
} else {
  const jwt = getLegacyServiceRole();
  if (!jwt) {
    console.error('Set HEALTH_REPORT_SECRET or ensure Supabase CLI can read service_role key.');
    process.exit(2);
  }
  headers.Authorization = `Bearer ${jwt}`;
}

const res = await fetch(healthUrl, {
  method: 'POST',
  headers,
  body: JSON.stringify({ slot: 'custom', to, subject, body }),
});

const data = await res.json().catch(() => ({}));
if (!res.ok || data.error) {
  console.error('Email failed:', data.error || data);
  process.exit(1);
}

console.log('Email sent successfully.');
console.log(`  To:       ${(data.recipients || [to]).join(', ')}`);
console.log(`  Subject:  ${data.subject || subject}`);
console.log(`  Provider: ${data.email?.provider || '—'}`);
