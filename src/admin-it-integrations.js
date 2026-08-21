/** Admin — IT vendor / API integrations (ON · OFF · HOLD-UNTIL). */
import { useState, useEffect, useCallback } from 'react';

function fmtLocalInput(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}

function fmtSeen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export function AdminItIntegrationsTab({ pin, adminHubFetch, C, S, FF, Spin, Btn }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busyId, setBusyId] = useState('');
  const [drafts, setDrafts] = useState({});

  const load = useCallback(async () => {
    if (!pin || !adminHubFetch) return;
    setLoading(true);
    setErr('');
    try {
      const r = await adminHubFetch('get_it_integrations', {}, pin);
      setRows(r.integrations || []);
    } catch (e) {
      setErr(e.message || 'Could not load integrations');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [pin, adminHubFetch]);

  useEffect(() => { load(); }, [load]);

  const draftFor = (row) => {
    if (!row?.id) {
      return {
        vendor_name: '', contact_phone: '', portal_url: '', api_url: '', credential_purpose: '',
        scanv_usage: '', switch_state: 'on', hold_until: '',
      };
    }
    if (drafts[row.id]) return drafts[row.id];
    return {
      vendor_name: row.vendor_name || '',
      contact_phone: row.contact_phone || '',
      portal_url: row.portal_url || '',
      api_url: row.api_url || '',
      credential_purpose: row.credential_purpose || '',
      scanv_usage: row.scanv_usage || '',
      switch_state: row.switch_state || 'on',
      hold_until: fmtLocalInput(row.hold_until),
    };
  };

  const setDraft = (id, patch) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...draftFor(rows.find((r) => r.id === id) || {}), ...(prev[id] || {}), ...patch },
    }));
  };

  const save = async (row, patch) => {
    setBusyId(row.id);
    setMsg('');
    setErr('');
    try {
      const r = await adminHubFetch('update_it_integration', { id: row.id, patch }, pin);
      setMsg(`${row.vendor_name} saved`);
      if (r.integration) {
        setRows((prev) => prev.map((x) => (x.id === row.id ? r.integration : x)));
      } else {
        await load();
      }
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
    } catch (e) {
      setErr(e.message || 'Save failed');
    } finally {
      setBusyId('');
    }
  };

  const applySwitch = (row, switchState, holdUntilLocal) => {
    const patch = { switch_state: switchState };
    if (switchState === 'hold') {
      if (!holdUntilLocal) {
        setErr('Pick date & time for HOLD-UNTIL');
        return;
      }
      patch.hold_until = new Date(holdUntilLocal).toISOString();
    }
    save(row, patch);
  };

  if (loading && !rows.length) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, color: C.dim, fontSize: 11 }}>
        <Spin size={16} /> Loading IT integrations…
      </div>
    );
  }

  if (err && !rows.length) {
    return (
      <div style={{ ...S.card(), padding: 16, color: C.red, fontSize: 12 }}>
        {err}
        <div style={{ fontSize: 11, color: C.dim, marginTop: 8 }}>
          Run migration <code>20260821000002_it_integrations.sql</code> if the table is missing.
        </div>
      </div>
    );
  }

  const switchPill = (state, active) => ({
    padding: '5px 10px',
    borderRadius: 16,
    border: `1.5px solid ${active ? C.acc : C.bdr}`,
    background: active ? `${C.acc}18` : C.surf,
    color: active ? C.acc : C.sub,
    fontSize: 10,
    fontWeight: 700,
    cursor: busyId ? 'wait' : 'pointer',
    fontFamily: FF,
  });

  return (
    <div>
      <div style={{ ...S.card(), padding: 16, marginBottom: 14, border: `1.5px solid ${C.acc}44` }}>
        <div style={{ fontWeight: 800, color: C.txt, fontSize: 16, marginBottom: 6 }}>IT vendors & integrations</div>
        <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.55 }}>
          Third-party APIs ScanV depends on — <strong style={{ color: C.txt }}>Tool name</strong>, contact, portal/API URLs,
          credential env keys, and <strong style={{ color: C.txt }}>what ScanV uses each tool for</strong>.
          ON / OFF / HOLD-UNTIL switches apply where a runtime flag exists. Secrets are never shown here.
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn v="outline" sm type="button" onClick={load} disabled={loading}>Reload</Btn>
          <span style={{ fontSize: 11, color: C.dim, alignSelf: 'center' }}>{rows.length} vendors</span>
        </div>
      </div>

      {msg ? <div style={{ ...S.card(), padding: 10, marginBottom: 12, fontSize: 11, color: C.grn }}>{msg}</div> : null}
      {err && rows.length ? <div style={{ ...S.card(), padding: 10, marginBottom: 12, fontSize: 11, color: C.red }}>{err}</div> : null}

      <div style={{ display: 'grid', gap: 12 }}>
        {rows.map((row) => {
          const d = draftFor(row);
          const busy = busyId === row.id;
          const hasDraft = !!drafts[row.id];
          return (
            <div key={row.id} style={{ ...S.card(), padding: 14, border: row.hold_active ? `1.5px solid ${C.gold}` : `1px solid ${C.bdr}` }}>
              <div style={{ fontSize: 9, color: C.dim, fontFamily: 'monospace', marginBottom: 6 }}>
                Tool ID · {row.id}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <label style={{ fontSize: 10, color: C.dim, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                    Tool name
                  </label>
                  <input
                    value={d.vendor_name}
                    disabled={busy}
                    onChange={(e) => setDraft(row.id, { vendor_name: e.target.value })}
                    style={{ ...S.inp(), fontSize: 14, fontWeight: 800, display: 'block', width: '100%' }}
                  />
                  {!hasDraft && row.scanv_usage ? (
                    <div style={{ fontSize: 10, color: C.dim, marginTop: 6, lineHeight: 1.45 }}>{row.scanv_usage}</div>
                  ) : null}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 999,
                    background: row.effective_enabled ? `${C.grn}22` : `${C.red}22`,
                    color: row.effective_enabled ? C.grn : C.red,
                  }}>
                    {row.effective_label}
                  </span>
                  {row.credential_key ? (
                    <div style={{ fontSize: 9, color: row.credential_configured ? C.grn : C.gold, marginTop: 4, fontWeight: 700 }}>
                      {row.credential_configured ? 'Secret set' : 'Secret missing'}
                    </div>
                  ) : null}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 10 }}>
                <label style={{ fontSize: 10, color: C.dim }}>
                  Contact
                  <input
                    value={d.contact_phone}
                    disabled={busy}
                    onChange={(e) => setDraft(row.id, { contact_phone: e.target.value })}
                    placeholder="Phone / email"
                    style={{ ...S.inp(), fontSize: 11, marginTop: 4, display: 'block', width: '100%' }}
                  />
                </label>
                <label style={{ fontSize: 10, color: C.dim }}>
                  Portal URL
                  <input
                    value={d.portal_url}
                    disabled={busy}
                    onChange={(e) => setDraft(row.id, { portal_url: e.target.value })}
                    style={{ ...S.inp(), fontSize: 11, marginTop: 4, display: 'block', width: '100%' }}
                  />
                </label>
                <label style={{ fontSize: 10, color: C.dim }}>
                  API URL
                  <input
                    value={d.api_url}
                    disabled={busy}
                    onChange={(e) => setDraft(row.id, { api_url: e.target.value })}
                    style={{ ...S.inp(), fontSize: 11, marginTop: 4, display: 'block', width: '100%' }}
                  />
                </label>
              </div>

              <div style={{ fontSize: 10, color: C.sub, marginBottom: 8, lineHeight: 1.5 }}>
                <strong style={{ color: C.txt }}>Credential key(s):</strong>{' '}
                {row.credential_key ? (
                  row.credential_key.split(/[,+]/).map((k) => k.trim()).filter(Boolean).map((k) => (
                    <code key={k} style={{ color: C.acc, marginRight: 6 }}>{k}</code>
                  ))
                ) : (
                  <span style={{ color: C.dim }}>— (external / Vercel / GitHub secrets)</span>
                )}
              </div>

              <label style={{ fontSize: 10, color: C.dim, display: 'block', marginBottom: 10 }}>
                Credential purpose (what the key does)
                <input
                  value={d.credential_purpose}
                  disabled={busy}
                  onChange={(e) => setDraft(row.id, { credential_purpose: e.target.value })}
                  placeholder="e.g. API key in URL path — primary SMS OTP"
                  style={{ ...S.inp(), fontSize: 11, marginTop: 4, display: 'block', width: '100%' }}
                />
              </label>

              <label style={{ fontSize: 10, color: C.dim, display: 'block', marginBottom: 10 }}>
                What ScanV uses this tool for
                <input
                  value={d.scanv_usage}
                  disabled={busy}
                  onChange={(e) => setDraft(row.id, { scanv_usage: e.target.value })}
                  style={{ ...S.inp(), fontSize: 11, marginTop: 4, display: 'block', width: '100%' }}
                />
              </label>

              {row.switch_key ? (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: C.dim, marginBottom: 6, fontWeight: 700 }}>Switch · {row.switch_key}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {['on', 'off', 'hold'].map((st) => (
                      <button
                        key={st}
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (st === 'hold') {
                            setDraft(row.id, { switch_state: 'hold' });
                            return;
                          }
                          applySwitch(row, st, null);
                        }}
                        style={switchPill(st, (hasDraft ? d.switch_state : row.switch_state) === st)}
                      >
                        {st === 'on' ? 'ON' : st === 'off' ? 'OFF' : 'HOLD-UNTIL'}
                      </button>
                    ))}
                    {(hasDraft ? d.switch_state : row.switch_state) === 'hold' || row.switch_state === 'hold' ? (
                      <input
                        type="datetime-local"
                        value={d.hold_until}
                        disabled={busy}
                        onChange={(e) => setDraft(row.id, { switch_state: 'hold', hold_until: e.target.value })}
                        style={{ ...S.inp(), fontSize: 10, padding: '6px 8px' }}
                      />
                    ) : null}
                    {(hasDraft ? d.switch_state : row.switch_state) === 'hold' ? (
                      <Btn v="primary" sm type="button" disabled={busy} onClick={() => applySwitch(row, 'hold', d.hold_until)}>
                        Apply hold
                      </Btn>
                    ) : null}
                  </div>
                  {row.hold_until ? (
                    <div style={{ fontSize: 9, color: C.gold, marginTop: 6 }}>
                      Hold until: {fmtSeen(row.hold_until)}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div style={{ fontSize: 10, color: C.dim, marginBottom: 10 }}>
                  No runtime switch — active when secrets are configured.
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {hasDraft ? (
                  <Btn v="primary" sm type="button" disabled={busy} onClick={() => save(row, {
                    vendor_name: d.vendor_name,
                    contact_phone: d.contact_phone,
                    portal_url: d.portal_url,
                    api_url: d.api_url,
                    credential_purpose: d.credential_purpose,
                    scanv_usage: d.scanv_usage,
                  })}
                  >
                    Save details
                  </Btn>
                ) : null}
                {row.portal_url ? (
                  <a href={row.portal_url} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: C.acc, alignSelf: 'center', fontWeight: 700 }}>
                    Open portal ↗
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
