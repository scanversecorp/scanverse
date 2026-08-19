/** Shared Terms / Privacy / DPDP acceptance for OTP gates */

import { useCallback, useState } from 'react';

export const SCANV_TERMS_STORAGE_KEY = 'scanv_terms_accepted';

export function readScanvTermsAccepted() {
  try {
    return !!localStorage.getItem(SCANV_TERMS_STORAGE_KEY);
  } catch {
    return false;
  }
}

export function writeScanvTermsAccepted() {
  try {
    localStorage.setItem(SCANV_TERMS_STORAGE_KEY, new Date().toISOString());
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

export function TermsAcceptanceField({ accepted, onAccept, C, BDR }) {
  if (accepted) {
    return (
      <div style={{ fontSize: 12, color: C.grn, marginBottom: 10, fontWeight: 700 }}>
        ✅ {SCANV_TERMS_ACCEPTED_LABEL} accepted
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
        <span style={{ fontSize: 13, color: C.sub, lineHeight: 1.6 }}>
          I accept{' '}
          <a href="/terms" style={{ color: C.acc }}>Terms & Conditions</a>,{' '}
          <a href="/privacy" style={{ color: C.acc }}>Privacy Policy</a>{' '}
          &{' '}
          <a href="/dpdp" style={{ color: C.acc }}>DPDP Act 2023</a>.{' '}
          <span style={{ color: C.acc }}>*</span>
        </span>
      </label>
    </div>
  );
}
