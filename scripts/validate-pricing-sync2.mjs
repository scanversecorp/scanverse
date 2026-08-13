const SB_URL = 'https://rwlwrmmqtedugcreweut.supabase.co';
const SB_KEY = process.env.SCANV_SB_KEY || 'sb_publishable_sx3krTi2ijpvn-K8wAQP6w_VFwH0vR3';

async function main() {
  const url = `${SB_URL}/rest/v1/service_prices_public?select=service_id,price_paise,mrp_paise,parent_id,is_category,service_name&order=service_id`;
  const res = await fetch(url, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
  const rows = await res.json();
  const subs = rows.filter((r) => r.parent_id && !r.is_category);
  const at2 = subs.filter((r) => Number(r.price_paise) === 200);
  const ok = subs.filter((r) => Number(r.price_paise) > 200);
  console.log('Total sub-services in public catalog:', subs.length);
  console.log('Sub-services with price_paise=200 (₹2):', at2.length);
  console.log('Sub-services with price_paise>200:', ok.length);
  console.log('\nExamples at ₹2:');
  at2.slice(0, 12).forEach((r) => {
    console.log(`  ${r.service_id} | mrp ₹${(r.mrp_paise/100).toFixed(2)} | ${r.service_name}`);
  });
  console.log('\nExamples with normal price:');
  ok.slice(0, 8).forEach((r) => {
    console.log(`  ${r.service_id} | price ₹${(r.price_paise/100).toFixed(2)} | mrp ₹${(r.mrp_paise/100).toFixed(2)}`);
  });
}

main();
