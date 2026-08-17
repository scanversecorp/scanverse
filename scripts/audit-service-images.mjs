#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const ROOT = path.resolve(process.cwd());
const app = fs.readFileSync(path.join(ROOT, 'src/App.js'), 'utf8');
const pub = path.join(ROOT, 'public');

const ARRAYS = [
  'HOUSEHOLD_SVCS', 'CLOUD_SVCS', 'LEGAL_SVCS', 'VIP_SVCS', 'HEALTH_SVCS',
  'PROPERTY_SVCS', 'DELIVERY_SVCS', 'FOOD_SVCS', 'BEAUTY_SVCS', 'REPAIRS_SVCS', 'TWO_WHEELER_SVCS', 'FOUR_WHEELER_SVCS',
];

function md5File(rel) {
  const p = path.join(pub, rel.replace(/^\//, ''));
  if (!fs.existsSync(p)) return 'MISSING';
  return crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex');
}

function parseArray(name) {
  const marker = `const ${name} = [`;
  const start = app.indexOf(marker);
  if (start < 0) return [];
  const end = app.indexOf('\n];', start);
  const block = app.slice(start, end);
  const svcs = [];
  const re = /id:'([^']+)'[^]*?name:'([^']*)'[^]*?sub:'([^']*)'[^]*?img:'([^']+)'/g;
  let m;
  while ((m = re.exec(block))) {
    const chunk = m[0];
    const parent = chunk.match(/parent:'([^']+)'/)?.[1] || inferParent(m[1]);
    svcs.push({ id: m[1], parent, name: m[2], sub: m[3], img: m[4], group: name });
  }
  return svcs;
}

function inferParent(id) {
  if (id.startsWith('hh-')) return 'household';
  if (id.startsWith('cl-')) return 'cloud';
  if (id.startsWith('tw-')) return 'two-wheeler';
  if (id.startsWith('fw-')) return 'four-wheeler';
  if (id.startsWith('dl-')) return 'delivery';
  if (id.startsWith('fd-')) return 'food';
  if (id.startsWith('hl-')) return 'health';
  if (id.startsWith('lg-')) return 'legal';
  if (id.startsWith('pr-')) return 'property';
  if (id.startsWith('vp-')) return 'vip';
  return '?';
}

function pathOwner(img) {
  if (img.startsWith('/home-models/')) return 'home-model';
  if (img.startsWith('/services/cloud/')) return 'cloud';
  if (img.startsWith('/services/two-wheeler/')) return 'two-wheeler';
  if (img.startsWith('/services/four-wheeler/')) return 'four-wheeler';
  if (img.startsWith('/services/delivery/')) return 'delivery';
  if (img.startsWith('/services/food/')) return 'food';
  if (img.startsWith('/services/health/')) return 'health';
  if (img.startsWith('/services/legal/')) return 'legal';
  if (img.startsWith('/services/property/')) return 'property';
  if (img.startsWith('/services/vip/')) return 'vip';
  if (img.startsWith('/services/')) return 'household';
  return 'unknown';
}

/** Known cross-category duplicate md5 groups (from repo audit) */
const CROSS_DUP = new Set([
  '576cbeb3fac456156f42758764f69977', // quick-clean + tw-wash
  'f666c083fdf4019c3b271d42f93c832e', // bathroom-deep + tw-deep
  '950baeeb60fb78bfbe423b09ffc92726', // care-plan + tw-battery
  '791fcbfd08e8a65f48f2d4af848b8841', // delivery/bulk + fw-pickup
  '0721031a2c680e8e59e5f5298491a9f3', // delivery/document + tw-fix
  'c38915e0d82446f8360d2082dc66f1c9', // delivery/intercity + fw-mechanic
  '688a55060407e83e133971db0a9a68a5', // delivery/parcel + tw-pickup
  '257d40023e7f82561134cef96c5ed94d', // delivery/sameday + tw-mechanic
  '1a8b8203030f41a3db5e8e5cfed71607', // flat-clean + fw-deep
  '2de6ed170ba6229edbac2f345b563e73', // sofa-clean + fw-detail
  '6343697e3eca8077340ad76194eaced6', // property/site-visit + fw-fix
  '5d5148968c7200b42605d5ed1e4a4ef3', // window-clean + fw-wash
  '2faa64f0fe42da6bfa2534803a27f26e', // home-models/household + house-help
]);

const all = ARRAYS.flatMap(parseArray);
const homeBlock = app.match(/const SVC_CARD_THEME = \{([\s\S]*?)\n\};/)?.[1] || '';
for (const m of homeBlock.matchAll(/'([\w-]+)':\s*\{[^}]*img:'(\/home-models\/[^']+)'/g)) {
  all.push({ id: m[1], parent: 'home-model', name: m[1], group: 'SVC_CARD_THEME', sub: '', img: m[2] });
}

const byHash = {};
for (const s of all) {
  s.md5 = md5File(s.img);
  if (!byHash[s.md5]) byHash[s.md5] = [];
  byHash[s.md5].push(s);
}

const rows = all.map((s) => {
  const owner = pathOwner(s.img);
  const pathOk = owner === s.parent || (s.parent === 'household' && owner === 'household');
  const crossDup = CROSS_DUP.has(s.md5);
  const dupes = (byHash[s.md5] || []).filter((x) => x.id !== s.id);
  const cross = dupes.filter((x) => x.parent !== s.parent);
  let verdict = 'MATCH';
  let reason = '';
  if (s.md5 === 'MISSING') { verdict = 'MISMATCH'; reason = 'missing file'; }
  else if (crossDup && cross.length) { verdict = 'MISMATCH'; reason = `duplicate: ${cross.map((x) => x.id).join(', ')}`; }
  else if (!pathOk) { verdict = 'MISMATCH'; reason = `path owner ${owner}`; }
  else if (s.parent === 'two-wheeler' || s.parent === 'four-wheeler') {
    // Vehicle services: block reused household/delivery/property stock photos
    const badReuse = ['household', 'delivery', 'property'].some((p) =>
      dupes.some((x) => x.parent === p)
    );
    if (badReuse) { verdict = 'MISMATCH'; reason = 'reused non-vehicle photo'; }
  }
  return { ...s, verdict, reason, owner };
});

const mismatch = rows.filter((r) => r.verdict === 'MISMATCH');
console.log('id\tparent\tverdict\tname\tsub\timg\tmd5\treason');
rows.forEach((r) => {
  console.log([r.id, r.parent, r.verdict, r.name, r.sub, r.img, r.md5, r.reason].join('\t'));
});
console.error(`\nTOTAL ${rows.length} | MATCH ${rows.length - mismatch.length} | MISMATCH ${mismatch.length}`);
