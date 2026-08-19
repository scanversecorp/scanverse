/** Shared Terms / Privacy / DPDP acceptance for OTP gates (GPS consent in /terms) */

import { useCallback, useState } from 'react';

export const SCANV_LEGAL_ENTITY = 'DCore Global Corporation';
export const SCANV_BRAND = 'ScanV';

export const SCANV_TERMS_STORAGE_KEY = 'scanv_terms_accepted';
export const SCANV_GPS_CONSENT_STORAGE_KEY = 'scanv_gps_consent_at';
export const SCANV_TERMS_VERSION = '2026-08-20';
export const SCANV_PARTNER_TERMS_VERSION = '2026-08-20';

export const SCANV_LEGAL_LINKS = [
  { key: 'terms', href: '/terms', label: 'Terms & Conditions' },
  { key: 'privacy', href: '/privacy', label: 'Privacy Policy' },
  { key: 'dpdp', href: '/dpdp', label: 'DPDP Act 2023' },
];

export const SCANV_PARTNER_LEGAL_LINKS = [
  { key: 'partner-terms', href: '/partner-terms', label: 'Partner Terms & Conditions' },
  { key: 'terms', href: '/terms', label: 'Terms & Conditions' },
  { key: 'privacy', href: '/privacy', label: 'Privacy Policy' },
  { key: 'dpdp', href: '/dpdp', label: 'DPDP Act 2023' },
];

export function formatTermsAcceptedAt(iso) {
  if (!iso) return '';
  try {
    return `${new Date(iso).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })} IST`;
  } catch {
    return iso;
  }
}

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
export function writeScanvTermsAccepted(iso = new Date().toISOString()) {
  try {
    localStorage.setItem(SCANV_TERMS_STORAGE_KEY, iso);
    localStorage.setItem(SCANV_GPS_CONSENT_STORAGE_KEY, iso);
  } catch {
    /* ignore */
  }
}

export const SCANV_TERMS_ACCEPTED_LABEL = 'Terms & Conditions, Privacy Policy & DPDP Act 2023';

export const SCANV_PARTNER_TERMS_ACCEPTED_LABEL =
  'Partner Terms & Conditions, Terms & Conditions, Privacy Policy & DPDP Act 2023';

export const SCANV_LIABILITY_DISCLAIMER =
  `We (ScanV or '${SCANV_LEGAL_ENTITY}') are not responsible for any liability, misuse, harm, damages, financial or mental impact, or any damages to any user, candidate, vendor, partner, service provider, or customer. You agree to these Terms & Conditions 100%.`;

export const SCANV_MANDATORY_ONBOARD_ACCEPTANCE =
  `Each and every person, company, or anybody joining ScanV (${SCANV_LEGAL_ENTITY}) — including users, customers, candidates, vendors, partners, service providers, or anyone else — must accept the Terms & Conditions before onboarding or use.`;

/** Manual acceptance only — never pre-checked from localStorage. */
export function useScanvTermsAcceptance() {
  const [accepted, setAccepted] = useState(false);
  const [acceptedAt, setAcceptedAt] = useState(null);
  const accept = useCallback(() => {
    const now = new Date().toISOString();
    writeScanvTermsAccepted(now);
    setAccepted(true);
    setAcceptedAt(now);
  }, []);
  const revoke = useCallback(() => {
    setAccepted(false);
    setAcceptedAt(null);
  }, []);
  return { accepted, acceptedAt, accept, revoke };
}

/** Partner onboarding — fresh manual acceptance each session. */
export function usePartnerTermsAcceptance() {
  const [accepted, setAccepted] = useState(false);
  const [acceptedAt, setAcceptedAt] = useState(null);
  const accept = useCallback(() => {
    const now = new Date().toISOString();
    setAccepted(true);
    setAcceptedAt(now);
  }, []);
  const revoke = useCallback(() => {
    setAccepted(false);
    setAcceptedAt(null);
  }, []);
  return { accepted, acceptedAt, accept, revoke };
}

const stopLinkBubble = (e) => e.stopPropagation();

function LegalLinksList({ links, accentColor, fontSize, separator, style, linkStyle, mutedColor }) {
  return (
    <span style={{ fontSize, lineHeight: 1.65, ...style }}>
      {links.map((item, i) => (
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

export function ScanvLegalLinks({ accentColor = '#d63a56', fontSize = 12, separator = ' · ', style, linkStyle, mutedColor = '#888' }) {
  return (
    <LegalLinksList
      links={SCANV_LEGAL_LINKS}
      accentColor={accentColor}
      fontSize={fontSize}
      separator={separator}
      style={style}
      linkStyle={linkStyle}
      mutedColor={mutedColor}
    />
  );
}

export function PartnerLegalLinks({ accentColor = '#d63a56', fontSize = 12, separator = ' · ', style, linkStyle, mutedColor = '#888' }) {
  return (
    <LegalLinksList
      links={SCANV_PARTNER_LEGAL_LINKS}
      accentColor={accentColor}
      fontSize={fontSize}
      separator={separator}
      style={style}
      linkStyle={linkStyle}
      mutedColor={mutedColor}
    />
  );
}

function TermsTimestampLine({ acceptedAt, C }) {
  if (!acceptedAt) return null;
  return (
    <div style={{ fontSize: 11, color: C.grn, marginTop: 10, fontWeight: 600, lineHeight: 1.5 }}>
      ✓ Manually accepted at {formatTermsAcceptedAt(acceptedAt)}
    </div>
  );
}

export function TermsAcceptanceField({ accepted, acceptedAt, onAccept, onRevoke, C, BDR }) {
  return (
    <div style={{ background: C.deep, border: BDR, borderRadius: 10, padding: 14, marginBottom: 14 }}>
      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={!!accepted}
          onChange={(e) => { if (e.target.checked) onAccept?.(); else onRevoke?.(); }}
          style={{ marginTop: 2, accentColor: C.acc, width: 18, height: 18, flexShrink: 0 }}
        />
        <span style={{ fontSize: 13, color: C.sub, lineHeight: 1.65 }}>
          I am joining ScanV ({SCANV_LEGAL_ENTITY}). I have read and{' '}
          <strong style={{ color: C.txt }}>100% agree</strong> to the{' '}
          <ScanvLegalLinks accentColor={C.acc} fontSize={13} mutedColor={C.dim} />
          . {SCANV_LIABILITY_DISCLAIMER} {SCANV_MANDATORY_ONBOARD_ACCEPTANCE}
          <span style={{ color: C.acc }}> *</span>
        </span>
      </label>
      <TermsTimestampLine acceptedAt={acceptedAt} C={C} />
    </div>
  );
}

export function PartnerTermsAcceptanceField({ accepted, acceptedAt, onAccept, onRevoke, C, BDR }) {
  return (
    <div style={{ background: C.deep, border: BDR, borderRadius: 10, padding: 14, marginBottom: 14 }}>
      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={!!accepted}
          onChange={(e) => { if (e.target.checked) onAccept?.(); else onRevoke?.(); }}
          style={{ marginTop: 2, accentColor: C.acc, width: 18, height: 18, flexShrink: 0 }}
        />
        <span style={{ fontSize: 13, color: C.sub, lineHeight: 1.65 }}>
          I am joining ScanV ({SCANV_LEGAL_ENTITY}) as an independent Partner / vendor / service provider. I have read and{' '}
          <strong style={{ color: C.txt }}>100% agree</strong> to the{' '}
          <PartnerLegalLinks accentColor={C.acc} fontSize={13} mutedColor={C.dim} />
          . {SCANV_LIABILITY_DISCLAIMER} {SCANV_MANDATORY_ONBOARD_ACCEPTANCE}
          <span style={{ color: C.acc }}> *</span>
        </span>
      </label>
      <TermsTimestampLine acceptedAt={acceptedAt} C={C} />
    </div>
  );
}
