/** Shared vendor outreach copy — Marathi + Hindi (Pune/PCMC). */
export function vendorOutreachMessage(businessName = 'partner') {
  const name = String(businessName || 'partner').trim() || 'partner';
  return [
    'नमस्कार / नमस्ते 🙏',
    '',
    'मी Jasmeen, DCORE Global — ScanV app (Wakad व PCMC).',
    '',
    `आम्ही verified customers च्या cleaning / home service bookings local partners ला पाठवतो. ${name} सोबत partner करू इच्छितो.`,
    '',
    '• Launch वर listing fee नाही / कोई listing fee नहीं',
    '• Price तुमची / आपकी — तुम्ही / आप ठरवता',
    '• Booking + UPI payment — app वर',
    '',
    'आज 10 min चा छोटा call होईल का? 📞',
    '',
    'Jasmeen S P | 8484850288',
  ].join('\n');
}

export const STRIKE_VENDORS = [
  { name: 'Shreyash Deep Cleaning', phone: '918805839885' },
  { name: 'Saaf Makers', phone: '918484888693' },
  { name: 'Deep Cleaning Pune', phone: '919975708557' },
  { name: 'Dirt Blaster Cleaning Services', phone: '917350321321' },
  { name: 'AS Deep Cleaning Services', phone: '918087100195' },
];
