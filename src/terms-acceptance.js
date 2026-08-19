/** Shared Terms / Privacy / DPDP acceptance for OTP gates (GPS consent in /terms) */

import { useCallback, useState } from 'react';

export const SCANV_TERMS_STORAGE_KEY = 'scanv_terms_accepted';
export const SCANV_GPS_CONSENT_STORAGE_KEY = 'scanv_gps_consent_at';

export const SCANV_LEGAL_LINKS = [
  { key: 'terms', href: '/terms', label: 'Terms & Conditions' },
  { key: 'privacy', href: '/privacy', label: 'Privacy Policy' },
  { key: 'dpdp', href: '/dpdp', label: 'DPDP Act 2023' },
];

export function readScanvTermsAccepted() {
  try {
    return !!localStorage.getItem(SCANV_TERMS_STORAGE_KEY);
  } catch {
    return false;
  }
}

export function readScanvGpsConsent() {
  try {
    return !!localStorage.getItem(SCANV_GPS_CONSENT_STORAGE_KEY);
  } catch {
    return false;
  }
}

/** Terms acceptance also records GPS consent (see Terms & Conditions page). */
export function writeScanvTermsAccepted() {
  const now = new Date().toISOString();
  try {
    localStorage.setItem(SCANV_TERMS_STORAGE_KEY, now);
    localStorage.setItem(SCANV_GPS_CONSENT_STORAGE_KEY, now);
  } catch {
    /* ignore */
  }
}

export const SCANV_TERMS_ACCEPTED_LABEL = 'Terms & Conditions, Privacy Policy & DPDP Act 2023';

export function useScanvTermsAcceptance() {
  const [accepted, setAccepted] = useState(readScanvTermsAccepted);
  const accept = useCallback(() => {
    writeScanvTermsAccepted();
    setAccepted(true);
  }, []);
  return { accepted, accept };
}

const stopLinkBubble = (e) => e.stopPropagation();

export function ScanvLegalLinks({ accentColor = '#d63a56', fontSize = 12, separator = ' · ', style, linkStyle, mutedColor = '#888' }) {
  return (
    <span style={{ fontSize, lineHeight: 1.65, ...style }}>
      {SCANV_LEGAL_LINKS.map((item, i) => (
        <span key={item.key}>
          {i > 0 ? <span style={{ color: mutedColor, fontWeight: 400 }}>{separator}</span> : null}
          <a
            href={item.href}
            onClick={stopLinkBubble}
            onMouseDown={stopLinkBubble}
            style={{ color: accentColor, fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 2, ...linkStyle }}
          >
            {item.label}
          </a>
        </span>
      ))}
    </span>
  );
}

export function TermsAcceptanceField({ accepted, onAccept, C, BDR }) {
  if (accepted) {
    return (
      <div style={{ fontSize: 10, color: C.grn, marginBottom: 8, fontWeight: 600, lineHeight: 1.5, textAlign: 'center' }}>
        ✅ Accepted{' '}
        <ScanvLegalLinks accentColor={C.grn} fontSize={10} mutedColor={C.grn} linkStyle={{ fontWeight: 600 }} />
      </div>
    );
  }
  return (
    <div style={{ background: C.deep, border: BDR, borderRadius: 10, padding: 14, marginBottom: 14 }}>
      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
        <input
          type="checkbox"
          onChange={(e) => { if (e.target.checked) onAccept?.(); }}
          style={{ marginTop: 2, accentColor: C.acc, width: 18, height: 18, flexShrink: 0 }}
        />
        <span style={{ fontSize: 13, color: C.sub, lineHeight: 1.65 }}>
          I accept{' '}
          <ScanvLegalLinks accentColor={C.acc} fontSize={13} mutedColor={C.dim} />
          <span style={{ color: C.acc }}> *</span>
        </span>
      </label>
    </div>
  );
}
