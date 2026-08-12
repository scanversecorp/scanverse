#!/usr/bin/env node
/**
 * Minimal load test — homepage + Supabase REST health (public endpoints only)
 * Usage: node scripts/loadtest.mjs [concurrency] [durationSec]
 */
const HOMEPAGE = process.env.LOADTEST_HOMEPAGE || 'https://scanv-tau.vercel.app';
const SUPABASE_URL = process.env.LOADTEST_SUPABASE_URL || 'https://rwlwrmmqtedugcreweut.supabase.co';
const ANON_KEY = process.env.LOADTEST_ANON_KEY || 'sb_publishable_sx3krTi2ijpvn-K8wAQP6w_VFwH0vR3';

const CONCURRENCY = Number(process.argv[2] || 75);
const DURATION_SEC = Number(process.argv[3] || 45);

const targets = [
  {
    name: 'Production homepage',
    url: HOMEPAGE,
    opts: { method: 'GET' },
  },
  {
    name: 'Supabase REST health (service_prices_public)',
    url: `${SUPABASE_URL}/rest/v1/service_prices_public?select=id&limit=1`,
    opts: {
      method: 'GET',
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      },
    },
  },
];

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function runTarget(target) {
  const latencies = [];
  let requests = 0;
  let successes = 0;
  let errors = 0;
  const errorSamples = new Map();
  const endAt = Date.now() + DURATION_SEC * 1000;
  let stop = false;

  async function worker() {
    while (!stop && Date.now() < endAt) {
      const t0 = performance.now();
      try {
        const res = await fetch(target.url, { ...target.opts, signal: AbortSignal.timeout(15000) });
        const ms = performance.now() - t0;
        latencies.push(ms);
        requests++;
        if (res.ok) successes++;
        else {
          errors++;
          const key = `HTTP ${res.status}`;
          errorSamples.set(key, (errorSamples.get(key) || 0) + 1);
        }
        await res.arrayBuffer().catch(() => {});
      } catch (e) {
        const ms = performance.now() - t0;
        latencies.push(ms);
        requests++;
        errors++;
        const key = e.name === 'TimeoutError' ? 'timeout' : (e.message || 'fetch error').slice(0, 40);
        errorSamples.set(key, (errorSamples.get(key) || 0) + 1);
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);
  stop = true;

  latencies.sort((a, b) => a - b);
  const avg = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
  const errDetail = [...errorSamples.entries()].map(([k, v]) => `${k}(${v})`).join(', ') || '—';

  return {
    endpoint: target.name,
    concurrency: CONCURRENCY,
    durationSec: DURATION_SEC,
    requests,
    successPct: requests ? ((successes / requests) * 100).toFixed(1) : '0.0',
    avgMs: avg.toFixed(0),
    p95Ms: percentile(latencies, 95).toFixed(0),
    errors: errDetail,
  };
}

console.log(`Load test: ${CONCURRENCY} concurrent, ${DURATION_SEC}s per endpoint\n`);
const results = [];
for (const t of targets) {
  process.stdout.write(`Running ${t.name}… `);
  const r = await runTarget(t);
  results.push(r);
  console.log(`${r.requests} reqs, ${r.successPct}% ok, avg ${r.avgMs}ms`);
}

console.log('\n--- Results (JSON) ---');
console.log(JSON.stringify(results, null, 2));
