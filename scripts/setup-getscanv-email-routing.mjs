#!/usr/bin/env node
/**
 * Create remaining getscanv.com Cloudflare Email Routing aliases.
 * Requires CLOUDFLARE_API_TOKEN (Zone.Email Routing Edit + Account Email Routing Addresses Edit).
 *
 * Usage:
 *   CLOUDFLARE_API_TOKEN=xxx node scripts/setup-getscanv-email-routing.mjs
 */
const TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const ZONE_ID = process.env.CLOUDFLARE_ZONE_ID || 'b4a0fb677e91ba69351d45dcd9cacfa0';
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '7f8fbca1a540bef510c9c39cf15aa0a8';

const JAS = 'jasmeen.workmail@gmail.com';
const SAM = 'samir.workmail@gmail.com';

const RULES = [
  { name: 'hello', to: 'hello@getscanv.com', forward: [JAS] },
  { name: 'connect', to: 'connect@getscanv.com', forward: [JAS] },
  { name: 'support', to: 'support@getscanv.com', forward: [JAS] },
  { name: 'partners', to: 'partners@getscanv.com', forward: [JAS] },
  { name: 'jas', to: 'jas@getscanv.com', forward: [JAS] },
  { name: 'sam', to: 'sam@getscanv.com', forward: [SAM] },
  { name: 'payments', to: 'payments@getscanv.com', forward: [SAM] },
  { name: 'reports', to: 'reports@getscanv.com', forward: [SAM] },
];

async function cf(path, opts = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const data = await res.json();
  if (!data.success) {
    const msg = data.errors?.map((e) => e.message).join('; ') || res.statusText;
    throw new Error(msg);
  }
  return data.result;
}

async function ensureDestination(email) {
  try {
    return await cf(`/accounts/${ACCOUNT_ID}/email/routing/addresses`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  } catch (e) {
    if (/already|duplicate/i.test(e.message)) return { email, status: 'exists' };
    throw e;
  }
}

async function listRules() {
  return cf(`/zones/${ZONE_ID}/email/routing/rules`);
}

async function createRule(rule) {
  return cf(`/zones/${ZONE_ID}/email/routing/rules`, {
    method: 'POST',
    body: JSON.stringify({
      name: rule.name,
      enabled: true,
      matchers: [{ type: 'literal', field: 'to', value: rule.to }],
      actions: [{ type: 'forward', value: rule.forward }],
    }),
  });
}

async function main() {
  if (!TOKEN) {
    console.error('Set CLOUDFLARE_API_TOKEN');
    process.exit(1);
  }

  console.log('Ensuring destination addresses…');
  for (const email of [JAS, SAM]) {
    const r = await ensureDestination(email);
    console.log(' ', email, r.status || 'requested/verified');
  }

  const existing = await listRules();
  const have = new Set(
    existing
      .filter((r) => r.enabled && r.matchers?.[0]?.value)
      .map((r) => r.matchers[0].value.toLowerCase()),
  );

  for (const rule of RULES) {
    if (have.has(rule.to.toLowerCase())) {
      console.log('skip (exists):', rule.to);
      continue;
    }
    try {
      await createRule(rule);
      console.log('created:', rule.to, '→', rule.forward.join(', '));
    } catch (e) {
      console.error('fail:', rule.to, '—', e.message);
    }
  }

  console.log('\nDone. Test: send mail to sam@getscanv.com after Samir destination is verified.');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
