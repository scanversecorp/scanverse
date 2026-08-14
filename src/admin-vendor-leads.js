/** Admin-only local vendor leads — fetched from admin-hub after PIN (not in public bundle). */
import { useState, useEffect, useMemo, useCallback } from 'react';

const THEME_COLORS = {
  pink: { color: '#F472B6', bg: '#FFF1F5', border: '#FBCFE8', label: 'Deep cleaning' },
  green: { color: '#34D399', bg: '#ECFDF5', border: '#A7F3D0', label: 'Home help' },
};

function telHref(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  return d ? `tel:+${d.startsWith('91') ? d : `91${d}`}` : null;
}

function mailHref(email) {
  const e = String(email || '').trim();
  return e ? `mailto:${e}` : null;
}

export function AdminVendorLeadsTab({ pin, adminHubFetch, C, S, FF, Spin }) {
  const [catalog, setCatalog] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [q, setQ] = useState('');
  const [subCard, setSubCard] = useState('all');
  const [serviceId, setServiceId] = useState('all');
  const [confidence, setConfidence] = useState('all');
  const [area, setArea] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchLeads = useCallback(async () => {
    if (!pin || !adminHubFetch) return;
    setLoading(true);
    setLoadErr('');
    try {
      const r = await adminHubFetch('get_vendor_leads', {
        q: q.trim(),
        sub_card: subCard,
        service_id: serviceId,
        confidence,
        area: area.trim(),
      }, pin);
      if (r?.error) throw new Error(r.error);
      setCatalog(r);
    } catch (e) {
      setLoadErr(e.message || 'Could not load vendor leads');
      setCatalog(null);
    } finally {
      setLoading(false);
    }
  }, [pin, adminHubFetch, q, subCard, serviceId, confidence, area]);

  useEffect(() => {
    const t = setTimeout(() => { fetchLeads(); }, q || area ? 320 : 0);
    return () => clearTimeout(t);
  }, [fetchLeads, q, area]);

  const services = catalog?.services || [];
  const vendors = catalog?.vendors || [];
  const card = catalog?.cards?.[0];

  const subCardOptions = useMemo(() => {
    const base = [{ id: 'all', label: 'All sub-cards' }];
    (card?.sub_cards || []).forEach((sc) => base.push({ id: sc.label, label: sc.label, theme: sc.theme }));
    return base;
  }, [card]);

  const chipBtn = (active) => ({
    padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${active ? C.acc : C.bdr}`,
    background: active ? `${C.acc}18` : C.surf, color: active ? C.acc : C.sub,
    fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: FF,
  });

  const tagStyle = (theme) => {
    const t = THEME_COLORS[theme] || { color: C.acc, bg: `${C.acc}12`, border: `${C.acc}44` };
    return {
      display: 'inline-block', fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
      color: t.color, background: t.bg, border: `1px solid ${t.border}`, marginRight: 4, marginBottom: 4,
    };
  };

  if (loadErr && !catalog) {
    return <div style={{ ...S.card(), padding: 16, color: C.red, fontSize: 12 }}>{loadErr}</div>;
  }

  return (
    <div>
      <div style={{ ...S.card(), padding: 16, marginBottom: 14, border: `1.5px solid ${C.gold}` }}>
        <div style={{ fontWeight: 800, color: C.txt, marginBottom: 6 }}>Confidential — vendor lead research</div>
        <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.6 }}>
          Local vendors for <strong style={{ color: C.txt }}>{card?.label || 'Household services'}</strong>
          {catalog?.meta?.market ? ` · ${catalog.meta.market}` : ''}
          {catalog?.meta?.captured_at ? ` · captured ${catalog.meta.captured_at}` : ''}
          . Loaded from server after Admin PIN — not in the customer app bundle.
        </div>
        {catalog?.stats ? (
          <div style={{ fontSize: 10, color: C.dim, marginTop: 8 }}>
            Showing {catalog.stats.shown} of {catalog.stats.total_vendors} vendors
          </div>
        ) : null}
      </div>

      <div style={{ ...S.card(), padding: 14, marginBottom: 14 }}>
        <div style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, phone, email, area, services…"
            style={{ ...S.inp(), fontSize: 12 }}
          />
          <input
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="Filter by area / PIN (e.g. Wakad, 411057)"
            style={{ ...S.inp(), fontSize: 12 }}
          />
          <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} style={{ ...S.inp(), fontSize: 12 }}>
            <option value="all">All ScanV services (14)</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name} · {s.sub_card}</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {subCardOptions.map((opt) => (
              <button key={opt.id} type="button" style={chipBtn(subCard === opt.id)} onClick={() => setSubCard(opt.id)}>
                {opt.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              ['all', 'All confidence'],
              ['high', 'Verified contact'],
              ['verify_maps', 'Verify in Maps'],
            ].map(([id, label]) => (
              <button key={id} type="button" style={chipBtn(confidence === id)} onClick={() => setConfidence(id)}>
                {label}
              </button>
            ))}
            <button type="button" style={chipBtn(false)} onClick={fetchLeads} disabled={loading}>
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {loading && !vendors.length ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, color: C.dim, fontSize: 11 }}>
          <Spin size={16} /> Loading vendor leads…
        </div>
      ) : null}

      {!loading && !vendors.length ? (
        <div style={{ ...S.card(), padding: 16, color: C.dim, fontSize: 12 }}>No vendors match these filters.</div>
      ) : null}

      <div style={{ display: 'grid', gap: 12 }}>
        {vendors.map((v) => {
          const open = expanded === v.id;
          return (
            <div key={v.id} style={{ ...S.card(), padding: 0, overflow: 'hidden', border: `1px solid ${C.bdr}` }}>
              <button
                type="button"
                onClick={() => setExpanded(open ? null : v.id)}
                style={{
                  width: '100%', textAlign: 'left', background: C.surf, border: 'none', cursor: 'pointer',
                  padding: '14px 16px', fontFamily: FF,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, color: C.txt, fontSize: 14, marginBottom: 4 }}>{v.business_name}</div>
                    <div style={{ fontSize: 10, color: C.dim, marginBottom: 6 }}>
                      {v.parent_card_label}
                      {v.sub_cards?.length ? ` · ${v.sub_cards.join(' · ')}` : ''}
                    </div>
                    <div style={{ marginBottom: 6 }}>
                      {(v.scanv_services || []).slice(0, open ? undefined : 4).map((s) => (
                        <span key={s.id} style={tagStyle(s.theme)} title={s.id}>{s.name}</span>
                      ))}
                      {!open && (v.scanv_services || []).length > 4 ? (
                        <span style={{ fontSize: 9, color: C.dim }}>+{(v.scanv_services || []).length - 4} more</span>
                      ) : null}
                    </div>
                    <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.45 }}>
                      {v.address?.area ? `${v.address.area}, ` : ''}{v.address?.city || 'Pune'}
                      {v.address?.pin ? ` · ${v.address.pin}` : ''}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 9, fontWeight: 800, textTransform: 'uppercase', flexShrink: 0,
                    padding: '5px 8px', borderRadius: 999,
                    color: v.confidence === 'high' ? C.grn : C.gold,
                    background: v.confidence === 'high' ? `${C.grn}18` : `${C.gold}18`,
                  }}>
                    {v.confidence === 'high' ? 'Verified' : 'Maps'}
                  </span>
                </div>
              </button>

              {open ? (
                <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${C.bdr}` }}>
                  <div style={{ paddingTop: 12, display: 'grid', gap: 10 }}>
                    {v.contact_person ? (
                      <div style={{ fontSize: 11, color: C.sub }}>Contact: <strong style={{ color: C.txt }}>{v.contact_person}</strong></div>
                    ) : null}

                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.dim, marginBottom: 4 }}>Full address</div>
                      <div style={{ fontSize: 11, color: C.txt, lineHeight: 1.5 }}>
                        {[v.shop_office, v.address?.building, v.address?.street, v.address?.area, v.address?.city, v.address?.pin, v.address?.state]
                          .filter(Boolean).join(', ') || '— confirm on call / Google Maps'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {(v.phones || []).map((p) => (
                        <a key={p} href={telHref(p)} style={{ fontSize: 11, color: C.acc, fontWeight: 700, textDecoration: 'none' }}>{p}</a>
                      ))}
                      {(v.emails || []).map((e) => (
                        <a key={e} href={mailHref(e)} style={{ fontSize: 11, color: C.acc, fontWeight: 700, textDecoration: 'none' }}>{e}</a>
                      ))}
                    </div>

                    {v.website ? (
                      <a href={v.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: C.acc }}>{v.website}</a>
                    ) : null}

                    {v.maps_name ? (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.maps_name + ' Pune')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 11, color: C.acc }}
                      >
                        Google Maps: {v.maps_name} ↗
                      </a>
                    ) : null}

                    <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.5 }}>
                      <strong style={{ color: C.txt }}>Offers:</strong> {v.services_offered || '—'}
                    </div>
                    {v.service_areas ? (
                      <div style={{ fontSize: 10, color: C.dim }}>Areas: {v.service_areas}</div>
                    ) : null}
                    {v.hours ? <div style={{ fontSize: 10, color: C.dim }}>Hours: {v.hours}</div> : null}
                    {v.rating ? <div style={{ fontSize: 10, color: C.dim }}>Rating: {v.rating}</div> : null}
                    {v.notes ? (
                      <div style={{ fontSize: 10, color: C.gold, lineHeight: 1.45, padding: 8, background: `${C.gold}10`, borderRadius: 8 }}>
                        {v.notes}
                      </div>
                    ) : null}
                    <div style={{ fontSize: 9, color: C.dim }}>Source: {v.source || '—'}</div>

                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.dim, marginBottom: 6 }}>ScanV service tags</div>
                      {(v.scanv_services || []).map((s) => (
                        <span key={s.id} style={tagStyle(s.theme)} title={`${s.id} · ₹${s.price_inr || '—'}`}>
                          {s.sub_card}: {s.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
