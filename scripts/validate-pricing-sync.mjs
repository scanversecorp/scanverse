/**
 * Read-only check: static sub-service prices vs service_prices_public (Pricing Admin source).
 * Does not print API keys.
 */
const SB_URL = 'https://rwlwrmmqtedugcreweut.supabase.co';
const SB_KEY = process.env.SCANV_SB_KEY || 'sb_publishable_sx3krTi2ijpvn-K8wAQP6w_VFwH0vR3';

const SAMPLE_IDS = [
  'lg-consult', 'lg-court', 'hh-bathroom-deep', 'hh-kitchen-deep',
  'cl-iaas', 'hl-doctor', 'vip-priority', 'fd-tiffin',
];

// Static template values from App.js (paise)
const STATIC = {
  'lg-consult': { mrp: 99900, price: 74925 },
  'lg-court': { mrp: 2999900, price: 2249925 },
  'hh-bathroom-deep': { mrp: 49900, price: 37425 },
  'hh-kitchen-deep': { mrp: 59900, price: 44925 },
  'cl-iaas': { mrp: 999900, price: 749925 },
  'hl-doctor': { mrp: 99900, price: 74925 },
  'vip-priority': { mrp: 99900, price: 74925 },
  'fd-tiffin': { mrp: 5999900, price: 4499925 },
};

const ru = (p) => (Number(p) / 100).toFixed(2);

async function main() {
  const url = `${SB_URL}/rest/v1/service_prices_public?select=service_id,price_paise,mrp_paise,service_status,active,service_name&service_id=in.(${SAMPLE_IDS.join(',')})`;
  const res = await fetch(url, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  if (!res.ok) {
    console.error('Fetch failed:', res.status, await res.text());
    process.exit(1);
  }
  const rows = await res.json();
  const byId = Object.fromEntries(rows.map((r) => [r.service_id, r]));

  console.log('Pricing sync validation (static template vs live DB)\n');
  console.log('service_id'.padEnd(22), 'static_price', 'db_price', 'static_mrp', 'db_mrp', 'match?');
  console.log('-'.repeat(85));

  let mismatches = 0;
  let missing = 0;
  for (const id of SAMPLE_IDS) {
    const st = STATIC[id];
    const db = byId[id];
    if (!db) {
      console.log(id.padEnd(22), ru(st.price).padStart(10), 'MISSING'.padStart(10), ru(st.mrp).padStart(10), 'MISSING'.padStart(10), 'NO DB ROW');
      missing++;
      continue;
    }
    const priceMatch = Number(db.price_paise) === st.price;
    const mrpMatch = Number(db.mrp_paise) === st.mrp;
    const ok = priceMatch && mrpMatch;
    if (!ok) mismatches++;
    console.log(
      id.padEnd(22),
      ru(st.price).padStart(10),
      ru(db.price_paise).padStart(10),
      ru(st.mrp).padStart(10),
      ru(db.mrp_paise).padStart(10),
      ok ? 'OK' : 'MISMATCH',
    );
  }

  console.log('\nSummary:', rows.length, 'DB rows fetched;', mismatches, 'mismatches;', missing, 'missing');
  if (mismatches || missing) {
    console.log('\nNote: Mismatch may mean admin changed prices (expected) OR sync not applied to sub-cards.');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
