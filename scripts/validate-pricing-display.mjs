const SB_URL = 'https://rwlwrmmqtedugcreweut.supabase.co';
const SB_KEY = process.env.SCANV_SB_KEY || 'sb_publishable_sx3krTi2ijpvn-K8wAQP6w_VFwH0vR3';
const DISC_PCT = 0.25;
const discPaise = (mrp) => Math.round(mrp * (1 - DISC_PCT));
const ru = (p) => (Number(p) / 100).toFixed(2);

function effectiveSvcPrices(mrp, price) {
  let m = Number(mrp) || 0;
  let p = Number(price) || 0;
  if (!m && p) m = Math.round(p / (1 - DISC_PCT));
  if (m > 0 && p > 0 && p < m * 0.15) p = discPaise(m);
  if (m > 0 && !p) p = discPaise(m);
  return { mrp: m, price: p };
}

async function main() {
  const ids = ['lg-consult', 'hh-bathroom-deep', 'hh-kitchen-deep'];
  const url = `${SB_URL}/rest/v1/service_prices_public?select=service_id,price_paise,mrp_paise&service_id=in.(${ids.join(',')})`;
  const rows = await fetch(url, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }).then((r) => r.json());

  console.log('What Pricing Admin stores (New ₹ / Current ₹) vs what sub-cards display:\n');
  for (const r of rows) {
    const { mrp, price } = effectiveSvcPrices(r.mrp_paise, r.price_paise);
    console.log(r.service_id);
    console.log(`  Admin New ₹ (DB price_paise):     ${ru(r.price_paise)}`);
    console.log(`  Admin Current ₹ (DB mrp_paise): ${ru(r.mrp_paise)}`);
    console.log(`  Sub-card shows (after app logic): MRP ₹${ru(mrp)}  →  ₹${ru(price)}`);
    console.log('');
  }
}

main();
