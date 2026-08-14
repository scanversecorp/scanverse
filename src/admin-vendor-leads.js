/** Admin-only local vendor leads — fetched once after PIN; filtered by main/sub-card multi-select. */
import { useState, useEffect, useMemo } from 'react';

const THEME_COLORS = {
  pink: { color: '#F472B6', bg: '#FFF1F5', border: '#FBCFE8' },
  green: { color: '#34D399', bg: '#ECFDF5', border: '#A7F3D0' },
  host: { color: '#2563EB', bg: '#DBEAFE', border: '#93C5FD' },
  build: { color: '#6366F1', bg: '#EEF2FF', border: '#A5B4FC' },
  care: { color: '#0891B2', bg: '#CFFAFE', border: '#67E8F9' },
  pack: { color: '#7C3AED', bg: '#F3E8FF', border: '#C4B5FD' },
  counsel: { color: '#6366F1', bg: '#EEF2FF', border: '#A5B4FC' },
  docs: { color: '#4F46E5', bg: '#E0E7FF', border: '#818CF8' },
  concierge: { color: '#D97706', bg: '#FEF3C7', border: '#FCD34D' },
  travel: { color: '#B45309', bg: '#FFEDD5', border: '#FDBA74' },
  home: { color: '#DC2626', bg: '#FEE2E2', border: '#FCA5A5' },
  clinical: { color: '#E11D48', bg: '#FFE4E6', border: '#FDA4AF' },
  find: { color: '#EA580C', bg: '#FFEDD5', border: '#FDBA74' },
  verify: { color: '#C2410C', bg: '#FFF7ED', border: '#FDBA74' },
  local: { color: '#0891B2', bg: '#CFFAFE', border: '#67E8F9' },
  express: { color: '#0E7490', bg: '#ECFEFF', border: '#A5F3FC' },
  daily: { color: '#DB2777', bg: '#FCE7F3', border: '#F9A8D4' },
  events: { color: '#BE185D', bg: '#FFF1F2', border: '#FDA4AF' },
  roadside: { color: '#EA580C', bg: '#FFEDD5', border: '#FDBA74' },
  service: { color: '#7C3AED', bg: '#EDE9FE', border: '#C4B5FD' },
};

const ONBOARD_STATUS_LABELS = {
  research: 'Research',
  contacted: 'Contacted',
  validating: 'Validating',
  ready: 'Ready',
  added: 'Added to ScanV',
  rejected: 'Rejected',
};

const VALIDATION_FIELDS = [
  { key: 'phone_verified', label: 'Phone verified', hint: 'Call / OTP on primary number' },
  { key: 'name_verified', label: 'Name verified', hint: 'Business + contact person match Aadhaar / PAN' },
  { key: 'address_verified', label: 'Address verified', hint: 'Shop or service area confirmed on Maps / visit' },
  { key: 'aadhaar_verified', label: 'Aadhaar verified', hint: 'Digio eKYC or manual last-4 check' },
];

function telHref(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  return d ? `tel:+${d.startsWith('91') ? d : `91${d}`}` : null;
}

function waHref(phone, text) {
  const d = String(phone || '').replace(/\D/g, '');
  if (!d) return null;
  const n = d.startsWith('91') ? d : `91${d}`;
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

const VENDOR_OUTREACH_MSG = (name) => {
  const n = name || 'partner';
  return [
    'नमस्कार / नमस्ते 🙏',
    '',
    'मी Jasmeen, DCORE Global — ScanV app (Wakad व PCMC).',
    '',
    `आम्ही verified customers च्या cleaning / home service bookings local partners ला पाठवतो. ${n} सोबत partner करू इच्छितो.`,
    '',
    '• Launch वर listing fee नाही / कोई listing fee नहीं',
    '• Price तुमची / आपकी — तुम्ही / आप ठरवता',
    '• Booking + UPI payment — app वर',
    '',
    'आज 10 min चा छोटा call होईल का? 📞',
    '',
    'Jasmeen S P | 9270194842',
  ].join('\n');
};

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
  const [savingId, setSavingId] = useState('');
  const [actionErr, setActionErr] = useState('');
  const [drafts, setDrafts] = useState({});

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

  const getDraft = (v) => {
    const onboard = v.onboard || {};
    return drafts[v.id] || {
      onboard_status: onboard.onboard_status || 'research',
      phone_verified: !!onboard.phone_verified,
      name_verified: !!onboard.name_verified,
      address_verified: !!onboard.address_verified,
      aadhaar_verified: !!onboard.aadhaar_verified,
      aadhaar_last4: onboard.aadhaar_last4 || '',
      validation_notes: onboard.validation_notes || '',
    };
  };

  const patchVendorOnboard = (leadId, onboard) => {
    setCatalog((prev) => {
      if (!prev?.vendors) return prev;
      return {
        ...prev,
        vendors: prev.vendors.map((v) => (v.id === leadId ? { ...v, onboard } : v)),
      };
    });
  };

  const saveLead = async (leadId, patch) => {
    setSavingId(leadId);
    setActionErr('');
    try {
      const r = await adminHubFetch('update_vendor_lead', { lead_id: leadId, ...patch }, pin);
      if (r?.error) throw new Error(r.error);
      patchVendorOnboard(leadId, r.onboard);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[leadId];
        return next;
      });
    } catch (e) {
      setActionErr(e.message || 'Could not save lead');
    } finally {
      setSavingId('');
    }
  };

  const addToScanV = async (v) => {
    const leadId = v.id;
    const draft = getDraft(v);
    setSavingId(leadId);
    setActionErr('');
    try {
      const saveR = await adminHubFetch('update_vendor_lead', { lead_id: leadId, ...draft }, pin);
      if (saveR?.error) throw new Error(saveR.error);
      patchVendorOnboard(leadId, saveR.onboard);
      const r = await adminHubFetch('add_vendor_lead_to_scanv', { lead_id: leadId }, pin);
      if (r?.error) throw new Error(r.error);
      patchVendorOnboard(leadId, r.onboard);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[leadId];
        return next;
      });
    } catch (e) {
      setActionErr(e.message || 'Could not add to ScanV');
    } finally {
      setSavingId('');
    }
  };

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
          Mark phone, name, address, and Aadhaar before adding a partner to ScanV.
          {catalog?.meta?.market ? ` Market: ${catalog.meta.market}.` : ''}
          {catalog?.meta?.captured_at ? ` Updated ${catalog.meta.captured_at}.` : ''}
        </div>
      </div>

      {actionErr ? (
        <div style={{ ...S.card(), padding: 12, marginBottom: 14, color: C.red, fontSize: 11 }}>{actionErr}</div>
      ) : null}

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
          const draft = getDraft(v);
          const onboard = v.onboard || {};
          const allVerified = draft.phone_verified && draft.name_verified && draft.address_verified && draft.aadhaar_verified;
          const canAdd = allVerified && onboard.onboard_status !== 'added' && !onboard.vendor_partner_id;
          const statusColor = onboard.onboard_status === 'added' ? C.grn
            : onboard.onboard_status === 'rejected' ? C.red
            : onboard.onboard_status === 'ready' ? C.acc
            : C.gold;
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
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ fontWeight: 800, color: C.txt, fontSize: 14 }}>{v.business_name}</div>
                      <span style={{
                        fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
                        padding: '4px 8px', borderRadius: 999, color: statusColor,
                        background: `${statusColor}18`, border: `1px solid ${statusColor}44`,
                      }}>
                        {ONBOARD_STATUS_LABELS[onboard.onboard_status] || 'Research'}
                      </span>
                      {allVerified ? (
                        <span style={{ fontSize: 9, fontWeight: 800, color: C.grn, background: `${C.grn}18`, padding: '4px 8px', borderRadius: 999 }}>
                          4/4 validated
                        </span>
                      ) : null}
                    </div>
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
                      {(v.phones || []).slice(0, 1).map((p) => {
                        const wa = waHref(p, VENDOR_OUTREACH_MSG(v.business_name));
                        return wa ? (
                          <a key={`wa-${p}`} href={wa} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: C.grn, fontWeight: 700, textDecoration: 'none' }}>WhatsApp outreach →</a>
                        ) : null;
                      })}
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

                    <div style={{ marginTop: 12, padding: 12, background: `${C.acc}06`, borderRadius: 10, border: `1px solid ${C.acc}22` }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: C.txt, marginBottom: 10 }}>Add to ScanV — validation</div>

                      <div style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
                        <label style={{ fontSize: 10, fontWeight: 700, color: C.dim }}>Onboard status</label>
                        <select
                          value={draft.onboard_status}
                          onChange={(e) => setDrafts((prev) => ({
                            ...prev,
                            [v.id]: { ...getDraft(v), onboard_status: e.target.value },
                          }))}
                          style={{ ...S.inp(), fontSize: 11, padding: '8px 10px' }}
                        >
                          {(catalog?.onboard_statuses || Object.keys(ONBOARD_STATUS_LABELS)).map((s) => (
                            <option key={s} value={s}>{ONBOARD_STATUS_LABELS[s] || s}</option>
                          ))}
                        </select>
                      </div>

                      <div style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
                        {VALIDATION_FIELDS.map((f) => (
                          <label key={f.key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer', fontSize: 11, color: C.txt }}>
                            <input
                              type="checkbox"
                              checked={!!draft[f.key]}
                              onChange={(e) => setDrafts((prev) => ({
                                ...prev,
                                [v.id]: { ...getDraft(v), [f.key]: e.target.checked },
                              }))}
                              style={{ marginTop: 2 }}
                            />
                            <span>
                              <strong>{f.label}</strong>
                              <span style={{ display: 'block', fontSize: 10, color: C.dim, fontWeight: 500 }}>{f.hint}</span>
                            </span>
                          </label>
                        ))}
                      </div>

                      <div style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
                        <label style={{ fontSize: 10, fontWeight: 700, color: C.dim }}>Aadhaar last 4 (after eKYC)</label>
                        <input
                          value={draft.aadhaar_last4}
                          onChange={(e) => setDrafts((prev) => ({
                            ...prev,
                            [v.id]: { ...getDraft(v), aadhaar_last4: e.target.value.replace(/\D/g, '').slice(0, 4) },
                          }))}
                          placeholder="1234"
                          maxLength={4}
                          style={{ ...S.inp(), fontSize: 11, width: 100 }}
                        />
                        <textarea
                          value={draft.validation_notes}
                          onChange={(e) => setDrafts((prev) => ({
                            ...prev,
                            [v.id]: { ...getDraft(v), validation_notes: e.target.value },
                          }))}
                          placeholder="Validation notes (call log, eKYC ref, Maps check…)"
                          rows={2}
                          style={{ ...S.inp(), fontSize: 11, resize: 'vertical' }}
                        />
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                        <button
                          type="button"
                          disabled={savingId === v.id}
                          onClick={() => saveLead(v.id, getDraft(v))}
                          style={{
                            padding: '8px 14px', borderRadius: 10, border: `1px solid ${C.bdr}`,
                            background: C.surf, color: C.acc, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FF,
                          }}
                        >
                          {savingId === v.id ? 'Saving…' : 'Save status'}
                        </button>
                        <button
                          type="button"
                          disabled={!canAdd || savingId === v.id}
                          title={canAdd ? 'Create pending vendor partner' : 'Check all four validations first'}
                          onClick={() => addToScanV(v)}
                          style={{
                            padding: '8px 14px', borderRadius: 10, border: 'none',
                            background: canAdd ? C.acc : `${C.dim}44`, color: '#fff',
                            fontSize: 11, fontWeight: 800, cursor: canAdd ? 'pointer' : 'not-allowed', fontFamily: FF,
                          }}
                        >
                          Add to ScanV
                        </button>
                        {onboard.vendor_partner_id ? (
                          <a
                            href={`#vendor-admin?vendor=${onboard.vendor_partner_id}`}
                            style={{ fontSize: 11, color: C.grn, fontWeight: 700, textDecoration: 'none' }}
                          >
                            Open in Vendor Admin →
                          </a>
                        ) : null}
                      </div>
                      {!allVerified ? (
                        <div style={{ fontSize: 10, color: C.dim, marginTop: 8 }}>
                          All four checks required before Add to ScanV: phone, name, address, Aadhaar.
                        </div>
                      ) : null}
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
