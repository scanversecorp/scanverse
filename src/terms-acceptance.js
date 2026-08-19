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
  `We (ScanV or '${SCANV_LEGAL_ENTITY}') are not responsible for any liability, misuse, harm, damages, financial or mental impact, or any other damages to Cloud candidates, service providers, vendors, client users, or any related or unrelated consumer, third party, or visitor. You agree to these policies 100%.`;

export const SCANV_MANDATORY_ONBOARD_ACCEPTANCE =
  `Each person, company, or entity joining ScanV (${SCANV_LEGAL_ENTITY}) must manually accept the Terms & Conditions, Privacy Policy, and DPDP Act 2023 before onboarding, registration, booking, payment, or use.`;

/** Five ScanV joiner categories — used across Terms, Privacy, Refund */
export const SCANV_JOINER_TYPES_INTRO =
  `ScanV (operated by ${SCANV_LEGAL_ENTITY}) serves five categories of joiners, plus any other person who accesses the platform:`;

export const SCANV_JOINER_TYPES = [
  ['Cloud & IT Candidates', 'Individuals applying for Skill Gap Review (SGR), cloud, data-centre, or IT training programmes via ScanV. Candidates are not employees of DCore; training outcomes, placement, certification, and fees are governed by programme terms and independent instructors/partners where applicable.'],
  ['Service Providers', 'Independent professionals or businesses listing and performing on-demand services (home repair, beauty, delivery, healthcare visits, legal consults, etc.) through ScanV. Service providers are independent contractors, not agents of DCore Global Corporation.'],
  ['Vendors', 'Independent sellers or suppliers providing goods or bundled goods-and-services (food, retail, parts, equipment, etc.) through ScanV listings or dispatch. Vendors are solely responsible for product quality, safety, licensing, and fulfilment.'],
  ['Client Users (End Users)', 'Customers who browse, book, pay platform fees, and receive services or goods through ScanV. Client users contract with independent service providers or vendors; DCore provides the technology marketplace only.'],
  ['Other Consumers & Third Parties', 'Any related or unrelated consumer, visitor, referrer, guest OTP user, support contact, or third party who interacts with ScanV — all subject to these policies and mandatory acceptance where OTP or onboarding applies.'],
];

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

export function ScanvLegalLinks({ accentColor = '#d63a56', fontSize = 10, separator = ' · ', style, linkStyle, mutedColor = '#888' }) {
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

export function PartnerLegalLinks({ accentColor = '#d63a56', fontSize = 10, separator = ' · ', style, linkStyle, mutedColor = '#888' }) {
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

export function TermsAcceptanceField({ accepted, onAccept, onRevoke, C, BDR }) {
  const linkGreen = C.grn || '#007a4d';
  if (accepted) {
    return (
      <div style={{ fontSize: 11, color: linkGreen, marginBottom: 10, fontWeight: 600, lineHeight: 1.5, textAlign: 'center' }}>
        ✅ Accepted{' '}
        <ScanvLegalLinks accentColor={linkGreen} fontSize={9} mutedColor={linkGreen} linkStyle={{ fontWeight: 600 }} />
      </div>
    );
  }
  return (
    <div style={{ background: C.deep, border: BDR, borderRadius: 10, padding: 12, marginBottom: 14 }}>
      <label style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer', justifyContent: 'center' }}>
        <input
          type="checkbox"
          checked={false}
          onChange={(e) => { if (e.target.checked) onAccept?.(); else onRevoke?.(); }}
          style={{ accentColor: linkGreen, width: 18, height: 18, flexShrink: 0 }}
        />
        <ScanvLegalLinks accentColor={linkGreen} fontSize={11} mutedColor={linkGreen} linkStyle={{ fontWeight: 600 }} />
      </label>
    </div>
  );
}

export function PartnerTermsAcceptanceField({ accepted, onAccept, onRevoke, C, BDR }) {
  return (
    <TermsAcceptanceField
      accepted={accepted}
      onAccept={onAccept}
      onRevoke={onRevoke}
      C={C}
      BDR={BDR}
    />
  );
}
