/** Shared vendor outreach copy — Marathi + Hindi (Pune/PCMC). Team voice: ScanV · DCore. */
export const SCANV_BUSINESS_PHONE = '9270194842';
export const SCANV_BUSINESS_PHONE_DISPLAY = '+91-9270194842';

export function vendorOutreachMessage(businessName = 'partner') {
  const name = String(businessName || 'partner').trim() || 'partner';
  return [
    'नमस्कार / नमस्ते 🙏',
    '',
    'आम्ही ScanV · DCore — Wakad व PCMC मध्ये local services booking app.',
    '',
    `आम्ही verified customers च्या cleaning / home service bookings partners ला पाठवतो. ${name} सोबत partner करू इच्छितो.`,
    '',
    '• Launch वर listing fee नाही / कोई listing fee नहीं',
    '• Price तुमची / आपकी — तुम्ही / आप ठरवता',
    '• Booking + UPI payment — app वर',
    '',
    'सकाळ 10 — संध्याकाळ 7 (IST) दरम्यान 10 min call होईल का? 📞',
    '',
    `ScanV · DCore | ${SCANV_BUSINESS_PHONE}`,
  ].join('\n');
}

export const STRIKE_VENDORS = [
  { name: 'Shreyash Deep Cleaning', phone: '918805839885' },
  { name: 'Saaf Makers', phone: '918484888693' },
  { name: 'Deep Cleaning Pune', phone: '919975708557' },
  { name: 'Dirt Blaster Cleaning Services', phone: '917350321321' },
  { name: 'AS Deep Cleaning Services', phone: '918087100195' },
];
