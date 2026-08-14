#!/usr/bin/env node
/** Regenerate Mac wa.me links with current Marathi/Hindi outreach copy. */
import { vendorOutreachMessage, STRIKE_VENDORS } from './lib/vendor-outreach-message.mjs';
import { writeFileSync } from 'fs';

const lines = [
  '#!/bin/bash',
  '# Mac fallback — opens pre-filled WhatsApp chats in Safari (Marathi + Hindi).',
  '# Auto-generated: node scripts/gen-vendor-whatsapp-links.mjs',
  '',
];

for (const v of STRIKE_VENDORS) {
  const text = vendorOutreachMessage(v.name);
  const url = `https://wa.me/${v.phone}?text=${encodeURIComponent(text)}`;
  lines.push(`open '${url}'`);
  lines.push('sleep 2');
}
lines.push('');
lines.push('echo "Opened 5 WhatsApp chats — tap Send on each."');
lines.push('');

writeFileSync(new URL('./open-vendor-whatsapp-links.sh', import.meta.url), lines.join('\n'));
console.log('Updated scripts/open-vendor-whatsapp-links.sh');
