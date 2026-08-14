/** Admin-only local vendor leads — fetched once after PIN; filtered by main/sub-card multi-select. */
import { useState, useEffect, useMemo } from 'react';

const THEME_COLORS = {
  pink: { color: '#F472B6', bg: '#FFF1F5', border: '#FBCFE8' },
  green: { color: '#34D399', bg: '#ECFDF5', border: '#A7F3D0' },
};

function telHref(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  return d ? `tel:+${d.startsWith('91') ? d : `91${d}`}` : null;
}

function mailHref(email) {
  const e = String(email || '').trim();
  return e ? `mailto:${e}` : null;
}

function toggleSet(set, value) {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function MultiSelectRow({ label, hint, options, selected, onChange, C, S, FF }) {
  const allSelected = options.length > 0 && options.every((o) => selected.has(o.value));

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.txt }}>{label}</div>
          {hint ? <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>{hint}</div> : null}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={() => onChange(new Set(options.map((o) => o.value)))}
            style={{ padding: '4px 10px', borderRadius: 999, border: `1px solid ${C.bdr}`, background: C.surf, color: C.acc, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: FF }}
          >
            Select all
          </button>
          <button
            type="button"
            onClick={() => onChange(new Set())}
            style={{ padding: '4px 10px', borderRadius: 999, border: `1px solid ${C.bdr}`, background: C.surf, color: C.sub, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: FF }}
          >
            Clear
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map((opt) => {
          const on = selected.has(opt.value);
          const theme = opt.theme ? THEME_COLORS[opt.theme] : null;
          const border = on ? (theme?.color || C.acc) : C.bdr;
          const bg = on ? (theme ? `${theme.color}18` : `${C.acc}18`) : C.surf;
          const color = on ? (theme?.color || C.acc) : C.sub;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(toggleSet(selected, opt.value))}
              style={{
                padding: '8px 14px', borderRadius: 12, border: `1.5px solid ${border}`, background: bg, color,
                fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FF, textAlign: 'left',
              }}
            >
              {on ? '✓ ' : ''}{opt.icon ? `${opt.icon} ` : ''}{opt.label}
              {opt.count != null ? <span style={{ fontWeight: 500, opacity: 0.85 }}> ({opt.count})</span> : null}
            </button>
          );
        })}
      </div>
      {!options.length ? (
        <div style={{ fontSize: 11, color: C.dim, padding: '8px 0' }}>Select a main card first.</div>
      ) : null}
      {!allSelected && options.length ? (
        <div style={{ fontSize: 10, color: C.dim, marginTop: 6 }}>{selected.size} of {options.length} selected</div>
      ) : null}
    </div>
  );
}

export function AdminVendorLeadsTab({ pin, adminHubFetch, C, S, FF, Spin }) {
  const [catalog, setCatalog] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [selectedMainCards, setSelectedMainCards] = useState(new Set());
  const [selectedSubCards, setSelectedSubCards] = useState(new Set());
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!pin || !adminHubFetch) return;
    let cancelled = false;
    setLoading(true);
    setLoadErr('');
    adminHubFetch('get_vendor_leads', {}, pin)
      .then((r) => {
        if (cancelled) return;
        if (r?.error) throw new Error(r.error);
        setCatalog(r);
        const mainIds = (r.cards || []).map((c) => c.id);
        const subLabels = (r.cards || []).flatMap((c) => (c.sub_cards || []).map((sc) => sc.label));
        setSelectedMainCards(new Set(mainIds));
        setSelectedSubCards(new Set(subLabels));
        setInitialized(true);
      })
      .catch((e) => {
        if (!cancelled) setLoadErr(e.message || 'Could not load vendor leads');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [pin, adminHubFetch]);

  const cards = catalog?.cards || [];
  const allVendors = catalog?.vendors || [];
  const allServices = catalog?.services || [];

  const mainCardOptions = useMemo(
    () => cards.map((c) => ({
      value: c.id,
      label: c.label,
      icon: c.icon || '',
      count: (c.sub_cards || []).length,
    })),
    [cards],
  );

  const subCardOptions = useMemo(() => {
    const activeCards = cards.filter((c) => selectedMainCards.has(c.id));
    return activeCards.flatMap((c) => (c.sub_cards || []).map((sc) => ({
      value: sc.label,
      label: sc.label,
      theme: sc.theme,
      count: allServices.filter((s) => s.parent_card_id === c.id && s.sub_card === sc.label).length,
    })));
  }, [cards, selectedMainCards, allServices]);

  useEffect(() => {
    if (!initialized || !subCardOptions.length) return;
    const allowed = new Set(subCardOptions.map((o) => o.value));
    setSelectedSubCards((prev) => {
      const next = new Set([...prev].filter((label) => allowed.has(label)));
      if (next.size === 0 && allowed.size) return allowed;
      return next;
    });
  }, [subCardOptions, initialized]);

  const activeServices = useMemo(() => allServices.filter(
    (s) => selectedMainCards.has(s.parent_card_id) && selectedSubCards.has(s.sub_card),
  ), [allServices, selectedMainCards, selectedSubCards]);

  const activeServiceIds = useMemo(() => new Set(activeServices.map((s) => s.id)), [activeServices]);

  const vendors = useMemo(() => {
    if (!selectedMainCards.size || !selectedSubCards.size) return [];
    const needle = q.trim().toLowerCase();
    return allVendors
      .map((v) => {
        const matched = (v.scanv_services || []).filter((s) => activeServiceIds.has(s.id));
        if (!matched.length) return null;
        const hay = [
          v.business_name, v.contact_person, v.address?.full, v.address?.area, v.address?.pin,
          ...(v.phones || []), ...(v.emails || []), v.services_offered, v.service_areas,
        ].join(' ').toLowerCase();
        if (needle && !hay.includes(needle)) return null;
        return { ...v, matched_services: matched };
      })
      .filter(Boolean)
      .sort((a, b) => a.business_name.localeCompare(b.business_name));
  }, [allVendors, activeServiceIds, selectedMainCards.size, selectedSubCards.size, q]);

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

  if (loading && !catalog) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, color: C.dim, fontSize: 11 }}>
        <Spin size={16} /> Loading vendor catalog…
      </div>
    );
  }

  const selectionSummary = [
    `${selectedMainCards.size} main card${selectedMainCards.size === 1 ? '' : 's'}`,
    `${selectedSubCards.size} sub-card${selectedSubCards.size === 1 ? '' : 's'}`,
    `${activeServices.length} service${activeServices.length === 1 ? '' : 's'}`,
    `${vendors.length} vendor${vendors.length === 1 ? '' : 's'}`,
  ].join(' · ');

  return (
    <div>
      <div style={{ ...S.card(), padding: 16, marginBottom: 14, border: `1.5px solid ${C.gold}` }}>
        <div style={{ fontWeight: 800, color: C.txt, marginBottom: 6 }}>Vendor leads by ScanV card</div>
        <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.6 }}>
          Pick main card(s) and sub-card(s). Vendors below are filtered to those services only.
          {catalog?.meta?.market ? ` Market: ${catalog.meta.market}.` : ''}
          {catalog?.meta?.captured_at ? ` Updated ${catalog.meta.captured_at}.` : ''}
        </div>
      </div>

      <div style={{ ...S.card(), padding: 16, marginBottom: 14 }}>
        <MultiSelectRow
          label="Main card"
          hint="ScanV home categories — select one or more"
          options={mainCardOptions}
          selected={selectedMainCards}
          onChange={setSelectedMainCards}
          C={C} S={S} FF={FF}
        />

        <MultiSelectRow
          label="Sub-card"
          hint="Service groups inside the selected main card(s)"
          options={subCardOptions}
          selected={selectedSubCards}
          onChange={setSelectedSubCards}
          C={C} S={S} FF={FF}
        />

        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.txt, marginBottom: 6 }}>Search vendors</div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, phone, email, area, PIN…"
            style={{ ...S.inp(), fontSize: 12 }}
          />
        </div>
      </div>

      <div style={{ ...S.card(), padding: '12px 16px', marginBottom: 14, background: `${C.acc}08`, border: `1px solid ${C.acc}33` }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.txt, marginBottom: 8 }}>{selectionSummary}</div>
        {activeServices.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {activeServices.map((s) => (
              <span key={s.id} style={tagStyle(s.theme)} title={s.id}>{s.name}</span>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: C.dim }}>Select at least one main card and one sub-card to see vendors.</div>
        )}
      </div>

      {!selectedMainCards.size || !selectedSubCards.size ? (
        <div style={{ ...S.card(), padding: 16, color: C.dim, fontSize: 12 }}>Choose main card and sub-card filters above.</div>
      ) : null}

      {selectedMainCards.size && selectedSubCards.size && !vendors.length ? (
        <div style={{ ...S.card(), padding: 16, color: C.dim, fontSize: 12 }}>No vendors found for these services{q ? ' matching your search' : ''}.</div>
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
                    <div style={{ fontWeight: 800, color: C.txt, fontSize: 14, marginBottom: 6 }}>{v.business_name}</div>
                    <div style={{ marginBottom: 6 }}>
                      {(v.matched_services || []).map((s) => (
                        <span key={s.id} style={tagStyle(s.theme)} title={`${s.sub_card} · ${s.id}`}>{s.name}</span>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.45 }}>
                      {v.address?.area ? `${v.address.area}, ` : ''}{v.address?.city || 'Pune'}
                      {v.address?.pin ? ` · ${v.address.pin}` : ''}
                    </div>
                    {(v.phones || []).length ? (
                      <div style={{ fontSize: 11, color: C.acc, marginTop: 4, fontWeight: 700 }}>{v.phones[0]}</div>
                    ) : null}
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
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${v.maps_name} Pune`)}`}
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
                    {v.service_areas ? <div style={{ fontSize: 10, color: C.dim }}>Areas: {v.service_areas}</div> : null}
                    {v.hours ? <div style={{ fontSize: 10, color: C.dim }}>Hours: {v.hours}</div> : null}
                    {v.notes ? (
                      <div style={{ fontSize: 10, color: C.gold, lineHeight: 1.45, padding: 8, background: `${C.gold}10`, borderRadius: 8 }}>
                        {v.notes}
                      </div>
                    ) : null}
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
