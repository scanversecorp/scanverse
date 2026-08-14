/** Business HQ — all-card revenue pipeline, vendor gaps, logistics status. */
import { useState, useEffect } from 'react';

const PHASE_LABELS = {
  research: 'Research',
  recruiting: 'Recruiting',
  soft_launch: 'Soft launch',
  live: 'Live',
  paused: 'Paused',
};

const PHASE_COLOR = {
  research: '#6B7280',
  recruiting: '#D97706',
  soft_launch: '#2563EB',
  live: '#059669',
  paused: '#DC2626',
};

export function AdminBusinessCommandTab({ pin, adminHubFetch, onNavigateTab, C, S, FF, Spin, Btn }) {
  const [data, setData] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [msg, setMsg] = useState('');
  const [blastBusy, setBlastBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadErr('');
    try {
      const r = await adminHubFetch('get_business_command', {}, pin);
      setData(r);
    } catch (e) {
      setLoadErr(e.message || 'Could not load business command');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!pin || !adminHubFetch) return;
    load();
  }, [pin, adminHubFetch]);

  const saveCard = async (cardId, patch) => {
    setBusyId(cardId);
    setMsg('');
    try {
      await adminHubFetch('update_card_business', { card_id: cardId, ...patch }, pin);
      setMsg('Saved');
      await load();
    } catch (e) {
      setMsg(e.message || 'Save failed');
    } finally {
      setBusyId('');
    }
  };

  if (loading && !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, color: C.dim, fontSize: 11 }}>
        <Spin size={16} /> Loading business HQ…
      </div>
    );
  }

  if (loadErr && !data) {
    return (
      <div style={{ ...S.card(), padding: 16, color: C.red, fontSize: 12 }}>
        {loadErr}
        <div style={{ fontSize: 11, color: C.dim, marginTop: 8 }}>
          Run migration <code>20260816000004_card_business_pipeline.sql</code>
        </div>
      </div>
    );
  }

  const s = data?.summary || {};
  const cards = data?.cards || [];
  const queue = data?.action_queue || [];
  const logistics = data?.logistics_pipeline || [];
  const strike = data?.strike_list || {};

  const markContacted = async (leadId) => {
    setBusyId(leadId);
    setMsg('');
    try {
      await adminHubFetch('update_vendor_lead', { lead_id: leadId, onboard_status: 'contacted' }, pin);
      setMsg('Marked contacted');
      await load();
    } catch (e) {
      setMsg(e.message || 'Update failed');
    } finally {
      setBusyId('');
    }
  };

  const sendViaScanV = async (leadId) => {
    setBusyId(leadId);
    setMsg('');
    try {
      const r = await adminHubFetch('send_vendor_outreach', { lead_id: leadId }, pin);
      if (r?.error) throw new Error(r.error);
      setMsg(`Sent via ${r.provider || 'ScanV WhatsApp'}`);
      await load();
    } catch (e) {
      setMsg(e.message || 'Send failed');
    } finally {
      setBusyId('');
    }
  };

  const blastStrikeList = async () => {
    setBlastBusy(true);
    setMsg('');
    try {
      const r = await adminHubFetch('send_strike_list_outreach', { limit: 5 }, pin);
      if (r?.error && !r?.results) throw new Error(r.error);
      setMsg(`Agent sent ${r.sent || 0}/${(r.results || []).length} via ScanV WhatsApp`);
      await load();
    } catch (e) {
      setMsg(e.message || 'Blast failed');
    } finally {
      setBlastBusy(false);
    }
  };

  const agent = data?.outreach_agent || {};
  const canOutreach = agent.outreach_window_open !== false;

  const waUrl = (phone, text) => {
    const d = String(phone || '').replace(/\D/g, '');
    if (!d) return null;
    const n = d.startsWith('91') ? d : `91${d}`;
    return `https://wa.me/${n}?text=${encodeURIComponent(text || '')}`;
  };

  return (
    <div>
      <div style={{ ...S.card(), padding: 16, marginBottom: 14, border: `1.5px solid ${C.acc}` }}>
        <div style={{ fontWeight: 800, color: C.txt, fontSize: 16, marginBottom: 6 }}>ScanV Business HQ</div>
        <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.55, marginBottom: 12 }}>
          All 10 cards · vendor gaps · logistics pipeline · what to do next to make money.
          ScanV runs ops here — no waiting on Mac access.
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <Stat label="Readiness" value={`${s.overall_readiness_pct || 0}%`} color={C.acc} />
          <Stat label="Catalog vendors" value={s.catalog_vendor_count || 0} color={C.cyan} />
          <Stat label="Live partners" value={s.active_partners || 0} color={C.grn} />
          <Stat label="Logistics due" value={s.logistics_follow_up_due || 0} color={s.logistics_follow_up_due ? C.gold : C.dim} />
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn v="outline" sm type="button" onClick={load} disabled={loading}>Refresh</Btn>
          {onNavigateTab ? (
            <>
              <Btn v="outline" sm type="button" onClick={() => onNavigateTab('vendor-leads')}>Vendor leads →</Btn>
              <Btn v="outline" sm type="button" onClick={() => onNavigateTab('logistics')}>Logistics API →</Btn>
            </>
          ) : null}
        </div>
      </div>

      {msg ? (
        <div style={{ ...S.card(), padding: 10, marginBottom: 12, fontSize: 11, color: msg.includes('fail') ? C.red : C.grn }}>{msg}</div>
      ) : null}

      {(strike.vendors || []).length ? (
        <div style={{ ...S.card(), padding: 14, marginBottom: 14, border: `1.5px solid ${C.gold}` }}>
          {!canOutreach ? (
            <div style={{ fontSize: 11, color: C.gold, fontWeight: 700, marginBottom: 10, padding: 10, borderRadius: 8, background: `${C.gold}12` }}>
              ⏸ Outreach paused — {agent.outreach_hours || '9:30 AM – 7 PM IST'}. Vendors are sleeping; queue for daytime.
            </div>
          ) : null}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
            <div style={{ fontWeight: 800, color: C.txt, fontSize: 13 }}>Today&apos;s strike list — call / WhatsApp</div>
            {agent.whatsapp_configured && canOutreach ? (
              <Btn v="primary" sm type="button" disabled={blastBusy} onClick={blastStrikeList}>
                {blastBusy ? 'Sending…' : '🤖 Send all 5 via ScanV WA'}
              </Btn>
            ) : null}
          </div>
          <div style={{ fontSize: 10, color: C.dim, marginBottom: 10 }}>
            Household · Wakad/PCMC · {agent.outreach_hours || '9:30 AM – 7 PM IST'}
            {agent.business_number ? ` · from ${agent.business_number}` : ''}
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {strike.vendors.slice(0, 5).map((v) => (
              <div key={v.lead_id} style={{ padding: 10, borderRadius: 10, border: `1px solid ${C.bdr}`, background: `${C.gold}08` }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: C.txt }}>#{v.rank} {v.business_name}</div>
                <div style={{ fontSize: 10, color: C.sub, marginTop: 4 }}>{v.area} · {v.phone} · {v.onboard_status}</div>
                <div style={{ fontSize: 10, color: C.dim, marginTop: 6, lineHeight: 1.45 }}>{v.outreach_message}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {canOutreach ? (
                    <>
                      <a href={`tel:${String(v.phone).replace(/\s/g, '')}`} style={{ fontSize: 10, fontWeight: 700, color: C.acc, textDecoration: 'none' }}>Call →</a>
                      {waUrl(v.phone, v.outreach_message) ? (
                        <a href={waUrl(v.phone, v.outreach_message)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, fontWeight: 700, color: C.grn, textDecoration: 'none' }}>WhatsApp →</a>
                      ) : null}
                      {agent.whatsapp_configured ? (
                        <Btn v="outline" sm type="button" disabled={busyId === v.lead_id} onClick={() => sendViaScanV(v.lead_id)}>ScanV send</Btn>
                      ) : null}
                    </>
                  ) : (
                    <span style={{ fontSize: 10, color: C.dim }}>Call/WhatsApp after 9:30 AM IST</span>
                  )}
                  <Btn v="outline" sm type="button" disabled={busyId === v.lead_id} onClick={() => markContacted(v.lead_id)}>Mark contacted</Btn>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {(strike.logistics || []).length ? (
        <div style={{ ...S.card(), padding: 14, marginBottom: 14, border: `1.5px solid ${C.red}44` }}>
          <div style={{ fontWeight: 800, color: C.red, marginBottom: 8, fontSize: 13 }}>Logistics follow-ups DUE</div>
          {strike.logistics.map((p) => (
            <div key={p.partner_id} style={{ fontSize: 11, color: C.sub, marginBottom: 6 }}>
              {p.name} → {p.contact_email} · use docs/email-followup-plain.txt
            </div>
          ))}
          {onNavigateTab ? <Btn v="outline" sm type="button" onClick={() => onNavigateTab('logistics')}>Logistics tab →</Btn> : null}
        </div>
      ) : null}

      <div style={{ ...S.card(), padding: 14, marginBottom: 14 }}>
        <div style={{ fontWeight: 800, color: C.txt, marginBottom: 10, fontSize: 13 }}>Action queue (money first)</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {queue.map((a) => (
            <div key={a.card_id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', padding: 10, borderRadius: 10, border: `1px solid ${C.bdr}`, background: `${C.acc}06` }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: C.txt }}>#{a.priority} {a.label}</div>
                <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>{a.action}</div>
                {a.blocker ? <div style={{ fontSize: 10, color: C.gold, marginTop: 4 }}>Blocker: {a.blocker}</div> : null}
              </div>
              {onNavigateTab ? (
                <Btn v="outline" sm type="button" onClick={() => onNavigateTab(a.admin_tab)}>Open →</Btn>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {cards.map((c) => (
          <div key={c.card_id} style={{ ...S.card(), padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.txt }}>{c.icon} {c.label}</div>
                <div style={{ fontSize: 10, color: C.dim, marginTop: 4 }}>
                  {c.catalog_vendors} in catalog · {c.leads_added} on ScanV · {c.leads_ready} ready · {c.service_count} services
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: c.readiness_pct >= 80 ? C.grn : C.acc }}>{c.readiness_pct}%</div>
                <div style={{ fontSize: 9, color: C.dim }}>target {c.target_active_vendors} vendors</div>
                <span style={{
                  fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 999, marginTop: 6, display: 'inline-block',
                  color: PHASE_COLOR[c.go_live_phase] || C.dim,
                  background: `${PHASE_COLOR[c.go_live_phase] || C.dim}18`,
                }}
                >
                  {PHASE_LABELS[c.go_live_phase] || c.go_live_phase}
                </span>
              </div>
            </div>

            <div style={{ fontSize: 11, color: C.sub, marginBottom: 10, lineHeight: 1.5 }}>
              <strong style={{ color: C.txt }}>Next:</strong> {c.next_action || '—'}
              {c.gap_vendors > 0 ? <span style={{ color: C.gold }}> · Gap: {c.gap_vendors} vendors</span> : null}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
              <label style={{ fontSize: 10, color: C.dim }}>
                Phase
                <select
                  value={c.go_live_phase}
                  disabled={busyId === c.card_id}
                  onChange={(e) => saveCard(c.card_id, { go_live_phase: e.target.value, next_action: c.next_action, blocker: c.blocker, notes: c.notes })}
                  style={{ ...S.inp(), fontSize: 10, marginTop: 4, display: 'block', width: '100%' }}
                >
                  {Object.keys(PHASE_LABELS).map((k) => (
                    <option key={k} value={k}>{PHASE_LABELS[k]}</option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: 10, color: C.dim }}>
                Target vendors
                <input
                  type="number"
                  min={1}
                  defaultValue={c.target_active_vendors}
                  disabled={busyId === c.card_id}
                  onBlur={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (v && v !== c.target_active_vendors) saveCard(c.card_id, { target_active_vendors: v });
                  }}
                  style={{ ...S.inp(), fontSize: 10, marginTop: 4, display: 'block', width: '100%' }}
                />
              </label>
            </div>

            <textarea
              defaultValue={c.notes || ''}
              placeholder="Notes — calls made, deals, pricing…"
              rows={2}
              onBlur={(e) => {
                if (e.target.value !== (c.notes || '')) saveCard(c.card_id, { notes: e.target.value });
              }}
              style={{ ...S.inp(), fontSize: 10, width: '100%', marginTop: 8, resize: 'vertical' }}
            />
          </div>
        ))}
      </div>

      {logistics.length ? (
        <div style={{ ...S.card(), padding: 14, marginTop: 14 }}>
          <div style={{ fontWeight: 800, color: C.txt, marginBottom: 8, fontSize: 13 }}>Logistics API (delivery card)</div>
          <div style={{ fontSize: 10, color: C.dim, marginBottom: 8 }}>{logistics.filter((p) => p.outreach_status === 'email_sent').length} emailed · watch inbox at connect@dcoreglobal.com</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {logistics.map((p) => (
              <span key={p.id} style={{ fontSize: 10, padding: '4px 10px', borderRadius: 999, border: `1px solid ${C.bdr}`, color: C.sub }}>
                {p.name}: {p.outreach_status}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', minWidth: 90 }}>
      <div style={{ fontSize: 9, color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}
