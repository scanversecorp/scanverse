/**
 * homecards_v1 — backup snapshot of the home service cards UI (2026-08-11)
 * Horizontal gradient cards with emoji/icon thumbnails (household used model PNG).
 * Self-contained reference — copy ServiceFeaturedCardV1 back into App.js to restore.
 */

export const SVC_CARD_THEME_V1 = {
  legal:    { bgFrom:'#EEF2FF', bgTo:'#E0E7FF', b1:'#818CF8', b2:'#6366F1', glow:'rgba(99,102,241,0.18)' },
  cloud:    { bgFrom:'#DBEAFE', bgTo:'#BFDBFE', b1:'#60A5FA', b2:'#2563EB', glow:'rgba(37,99,235,0.18)' },
  vip:      { bgFrom:'#FEF3C7', bgTo:'#FDE68A', b1:'#FBBF24', b2:'#D97706', glow:'rgba(217,119,6,0.2)',  tag:'👑 Premium' },
  health:   { bgFrom:'#FEE2E2', bgTo:'#FECACA', b1:'#F87171', b2:'#DC2626', glow:'rgba(220,38,38,0.16)' },
  property: { bgFrom:'#FFEDD5', bgTo:'#FED7AA', b1:'#FB923C', b2:'#EA580C', glow:'rgba(234,88,12,0.18)' },
  household:{ bgFrom:'#FFF1F5', bgTo:'#ECFDF5', b1:'#FFD6E8', b2:'#86EFAC', glow:'rgba(244,114,182,0.22)', tag:'✨ POPULAR', img:'/services/house-help.png' },
  delivery: { bgFrom:'#CFFAFE', bgTo:'#A5F3FC', b1:'#22D3EE', b2:'#0891B2', glow:'rgba(8,145,178,0.18)' },
  food:     { bgFrom:'#FCE7F3', bgTo:'#FBCFE8', b1:'#F472B6', b2:'#DB2777', glow:'rgba(219,39,119,0.18)' },
};

/** @param {{ svc: object, onClick: Function, compact?: boolean, index?: number, fullWidth?: boolean, fmtRs: Function, SVC_SHORT: object, SVC_DETAIL: object, HOUSEHOLD_SVCS: array, C: object }} props */
export function ServiceFeaturedCardV1({ svc, onClick, compact, index = 0, fullWidth, fmtRs, SVC_SHORT, SVC_DETAIL, HOUSEHOLD_SVCS, C }) {
  const theme = SVC_CARD_THEME_V1[svc.id] || SVC_CARD_THEME_V1.legal;
  const d = SVC_DETAIL[svc.id] || {};
  const title = SVC_SHORT[svc.id] ? `${SVC_SHORT[svc.id]} services` : svc.name;
  const sub = svc.household ? `Deep clean · home help · ${HOUSEHOLD_SVCS.length} services` : svc.sub;
  const meta = svc.household
    ? `${d.rating || '4.8 ⭐'} · ${HOUSEHOLD_SVCS.length} options`
    : `${d.rating || '4.8 ⭐'} · ${d.turnaround?.split(' ').slice(0, 2).join(' ') || 'Same day'}`;
  const wide = fullWidth || svc.household;
  return (
    <div
      onClick={onClick}
      style={{
        gridColumn: wide && !compact ? '1 / -1' : 'auto',
        borderRadius: 16,
        overflow: 'hidden',
        cursor: 'pointer',
        border: '2px solid transparent',
        background: `linear-gradient(#fff,#fff) padding-box, linear-gradient(135deg, ${theme.b1}, ${theme.b2}) border-box`,
        boxShadow: `0 8px 24px ${theme.glow}`,
        animation: `fadeUp .35s ease ${index * 0.04}s both`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'stretch', minHeight: compact ? 84 : 112, background: `linear-gradient(135deg, ${theme.bgFrom} 0%, ${theme.bgTo} 100%)` }}>
        <div style={{ flex: 1, padding: compact ? '11px 13px' : '15px 17px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: compact ? 3 : 5 }}>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {theme.tag && <span style={{ background: svc.household ? C.acc : theme.b2, color: '#fff', fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 99 }}>{theme.tag}</span>}
            <span style={{ background: '#fef3c7', color: '#b45309', fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 99 }}>25% OFF</span>
          </div>
          <div style={{ color: C.txt, fontWeight: 800, fontSize: compact ? 13 : 15, lineHeight: 1.2 }}>{title}</div>
          <div style={{ color: C.sub, fontSize: compact ? 10 : 11, fontWeight: 600, lineHeight: 1.35 }}>{sub}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ color: C.acc, fontSize: compact ? 11 : 12, fontWeight: 800 }}>From ₹{fmtRs(svc.price)} →</span>
            <span style={{ color: C.dim, fontSize: compact ? 9 : 10, fontWeight: 600 }}>{meta}</span>
          </div>
        </div>
        <div style={{ width: compact ? 72 : 108, flexShrink: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {theme.img ? (
            <>
              <img src={theme.img} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }} />
              <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, ${theme.bgFrom} 0%, transparent 50%)` }} />
            </>
          ) : (
            <div style={{ fontSize: compact ? 36 : 44, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.08))' }}>{svc.icon}</div>
          )}
        </div>
      </div>
    </div>
  );
}
