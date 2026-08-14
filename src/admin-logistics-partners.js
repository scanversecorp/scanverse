/** Admin — logistics partner outreach pipeline (Porter, Borzo, etc.). */
import { useState, useEffect } from 'react';

const OUTREACH_LABELS = {
  not_started: 'Not started',
  email_sent: 'Email sent',
  follow_up_sent: 'Follow-up sent',
  replied: 'Replied',
  meeting: 'Meeting',
  contract: 'Contract',
  integrated: 'Integrated',
};

const API_LABELS = {
  none: 'No API',
  contacted: 'Contacted',
  in_discussion: 'In discussion',
  sandbox: 'Sandbox',
  live: 'Live',
  declined: 'Declined',
  paused: 'Paused',
};

const OUTREACH_OPTIONS = Object.keys(OUTREACH_LABELS);
const API_OPTIONS = Object.keys(API_LABELS);

function fmtDt(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

function isDue(iso) {
  if (!iso) return false;
  return new Date(iso) <= new Date();
}

export function AdminLogisticsPartnersTab({ pin, adminHubFetch, C, S, FF, Spin, Btn }) {
  const [partners, setPartners] = useState([]);
  const [dueCount, setDueCount] = useState(0);
  const [loadErr, setLoadErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [msg, setMsg] = useState('');

  const load = async () => {
    setLoading(true);
    setLoadErr('');
    try {
      const r = await adminHubFetch('get_logistics_pipeline', {}, pin);
      setPartners(r.partners || []);
      setDueCount(r.due_follow_up || 0);
    } catch (e) {
      setLoadErr(e.message || 'Could not load pipeline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!pin || !adminHubFetch) return;
    load();
  }, [pin, adminHubFetch]);

  const save = async (id, patch) => {
    setBusyId(id);
    setMsg('');
    try {
      await adminHubFetch('update_logistics_partner', { id, ...patch }, pin);
      setMsg('Saved');
      await load();
    } catch (e) {
      setMsg(e.message || 'Save failed');
    } finally {
      setBusyId('');
    }
  };

  const markFollowUpSent = (p) => save(p.id, {
    outreach_status: 'follow_up_sent',
    follow_up_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    notes: p.notes,
  });

  const markReplied = (p) => save(p.id, {
    outreach_status: 'replied',
    api_status: 'in_discussion',
    last_reply_at: new Date().toISOString(),
    follow_up_at: null,
    notes: p.notes,
  });

  if (loading && !partners.length) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, color: C.dim, fontSize: 11 }}>
        <Spin size={16} /> Loading logistics pipeline…
      </div>
    );
  }

  if (loadErr && !partners.length) {
    return (
      <div style={{ ...S.card(), padding: 16, color: C.red, fontSize: 12 }}>
        {loadErr}
        <div style={{ fontSize: 11, color: C.dim, marginTop: 8 }}>
          Run migration <code>20260816000003_logistics_partners_pipeline.sql</code> if tables are missing.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ ...S.card(), padding: 16, marginBottom: 14, border: `1.5px solid ${C.acc}44` }}>
        <div style={{ fontWeight: 800, color: C.txt, marginBottom: 6 }}>Logistics partners pipeline</div>
        <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.55 }}>
          Track Porter, Borzo, Shadowfax, QWQER, Delhivery outreach. ScanV acts — you review replies here.
          {dueCount > 0 ? (
            <span style={{ color: C.gold, fontWeight: 700 }}> · {dueCount} follow-up(s) due</span>
          ) : null}
        </div>
        <div style={{ marginTop: 10 }}>
          <Btn v="outline" sm type="button" onClick={load} disabled={loading}>Reload</Btn>
        </div>
      </div>

      {msg ? (
        <div style={{ ...S.card(), padding: 10, marginBottom: 12, fontSize: 11, color: msg.includes('fail') ? C.red : C.grn }}>{msg}</div>
      ) : null}

      <div style={{ display: 'grid', gap: 10 }}>
        {partners.map((p) => {
          const due = isDue(p.follow_up_at) && !['integrated', 'declined'].includes(p.outreach_status);
          return (
            <div
              key={p.id}
              style={{
                ...S.card(),
                padding: 14,
                border: due ? `1.5px solid ${C.gold}` : `1px solid ${C.bdr}`,
                background: due ? `${C.gold}08` : C.surf,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, color: C.txt, fontSize: 15 }}>{p.name}</div>
                  <a href={`mailto:${p.contact_email}`} style={{ fontSize: 11, color: C.acc }}>{p.contact_email}</a>
                  {p.website ? (
                    <div style={{ fontSize: 10, marginTop: 4 }}>
                      <a href={p.website} target="_blank" rel="noreferrer" style={{ color: C.sub }}>{p.website}</a>
                    </div>
                  ) : null}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, padding: '4px 8px', borderRadius: 999, background: `${C.acc}18`, color: C.acc }}>
                    {OUTREACH_LABELS[p.outreach_status] || p.outreach_status}
                  </span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: C.dim }}>
                    API: {API_LABELS[p.api_status] || p.api_status}
                  </span>
                </div>
              </div>

              <div style={{ fontSize: 10, color: C.dim, marginBottom: 10, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <span>Sent: {fmtDt(p.sent_at)}</span>
                <span style={{ color: due ? C.gold : C.dim, fontWeight: due ? 700 : 400 }}>
                  Follow-up: {fmtDt(p.follow_up_at)}{due ? ' · DUE' : ''}
                </span>
                {p.last_reply_at ? <span>Last reply: {fmtDt(p.last_reply_at)}</span> : null}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 10 }}>
                <label style={{ fontSize: 10, color: C.dim }}>
                  Outreach
                  <select
                    value={p.outreach_status}
                    disabled={busyId === p.id}
                    onChange={(e) => save(p.id, { outreach_status: e.target.value, notes: p.notes })}
                    style={{ ...S.inp(), fontSize: 10, marginTop: 4, display: 'block', width: '100%' }}
                  >
                    {OUTREACH_OPTIONS.map((k) => (
                      <option key={k} value={k}>{OUTREACH_LABELS[k]}</option>
                    ))}
                  </select>
                </label>
                <label style={{ fontSize: 10, color: C.dim }}>
                  API status
                  <select
                    value={p.api_status}
                    disabled={busyId === p.id}
                    onChange={(e) => save(p.id, { api_status: e.target.value, notes: p.notes })}
                    style={{ ...S.inp(), fontSize: 10, marginTop: 4, display: 'block', width: '100%' }}
                  >
                    {API_OPTIONS.map((k) => (
                      <option key={k} value={k}>{API_LABELS[k]}</option>
                    ))}
                  </select>
                </label>
              </div>

              <textarea
                defaultValue={p.notes || ''}
                placeholder="Notes — reply summary, contact name, sandbox URL…"
                rows={2}
                onBlur={(e) => {
                  if (e.target.value !== (p.notes || '')) save(p.id, { notes: e.target.value });
                }}
                style={{ ...S.inp(), fontSize: 10, width: '100%', resize: 'vertical', marginBottom: 10 }}
              />

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <Btn v="outline" sm type="button" disabled={busyId === p.id} onClick={() => markFollowUpSent(p)}>
                  Mark follow-up sent
                </Btn>
                <Btn v="outline" sm type="button" disabled={busyId === p.id} onClick={() => markReplied(p)}>
                  Mark replied
                </Btn>
                <a
                  href={`mailto:${p.contact_email}?subject=Follow-up%3A%20ScanV%20API%20Pune%20pilot&body=Hi%2C%0A%0AFollowing%20up%20on%20our%20ScanV%20(DCORE%20Global%20Corporation)%20API%20integration%20email.%0A%0AJasmeen%20S%20P%0A%2B91-8484850288%0Aconnect%40dcoreglobal.com`}
                  style={{
                    padding: '6px 12px', borderRadius: 10, border: `1px solid ${C.bdr}`, background: C.surf,
                    color: C.acc, fontSize: 10, fontWeight: 700, textDecoration: 'none', fontFamily: FF,
                  }}
                >
                  Open follow-up mail ↗
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
