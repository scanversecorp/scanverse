/** Admin — per-service schedule input file editor (#admin?tab=schedule) */
import { useEffect, useMemo, useState } from 'react';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const PARENT_ORDER = [
  'legal', 'cloud', 'vip', 'health', 'property', 'household', 'delivery', 'food', 'two-wheeler', 'four-wheeler',
];

function emptyWindows() {
  return [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, start: '09:00', end: '19:00' }));
}

function groupServicesByParent(services) {
  const map = new Map();
  for (const s of services || []) {
    const parentId = s.parent_id || 'other';
    if (!map.has(parentId)) {
      map.set(parentId, {
        parentId,
        parentName: s.parent_name || parentId,
        services: [],
      });
    }
    map.get(parentId).services.push(s);
  }
  const groups = [...map.values()];
  groups.sort((a, b) => {
    const ai = PARENT_ORDER.indexOf(a.parentId);
    const bi = PARENT_ORDER.indexOf(b.parentId);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return String(a.parentName).localeCompare(String(b.parentName));
  });
  for (const g of groups) {
    g.services.sort((a, b) => String(a.service_name || a.service_id).localeCompare(String(b.service_name || b.service_id)));
  }
  return groups;
}

export function AdminServiceScheduleTab({ pin, adminHubFetch, C, S, FF, Spin, Btn }) {
  const [services, setServices] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState(null);
  const [serviceName, setServiceName] = useState('');
  const [loadErr, setLoadErr] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [expandedParents, setExpandedParents] = useState(() => new Set());

  useEffect(() => {
    if (!pin) return;
    let cancelled = false;
    setLoadErr('');
    adminHubFetch('list_service_schedules', {}, pin)
      .then((r) => {
        if (cancelled) return;
        if (r?.error) throw new Error(r.error);
        setServices(r.services || []);
        if (!selectedId && r.services?.[0]) setSelectedId(r.services[0].service_id);
      })
      .catch((e) => { if (!cancelled) setLoadErr(e.message || 'Could not load schedules'); });
    return () => { cancelled = true; };
  }, [pin, adminHubFetch]);

  useEffect(() => {
    if (!pin || !selectedId) return;
    let cancelled = false;
    setBusy(true);
    setSaveMsg('');
    adminHubFetch('get_service_schedule', { service_id: selectedId }, pin)
      .then((r) => {
        if (cancelled) return;
        if (r?.error) throw new Error(r.error);
        setDraft({ ...r.schedule, windows: [...(r.schedule?.windows || emptyWindows())] });
        setServiceName(r.service_name || selectedId);
      })
      .catch((e) => { if (!cancelled) setLoadErr(e.message || 'Could not load service schedule'); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [pin, selectedId, adminHubFetch]);

  const grouped = useMemo(() => groupServicesByParent(services), [services]);

  useEffect(() => {
    if (!grouped.length) return;
    setExpandedParents(new Set(grouped.map((g) => g.parentId)));
  }, [grouped]);

  useEffect(() => {
    if (!selectedId || !services?.length) return;
    const svc = services.find((s) => s.service_id === selectedId);
    if (svc?.parent_id) {
      setExpandedParents((prev) => new Set([...prev, svc.parent_id]));
    }
  }, [selectedId, services]);

  const toggleParent = (parentId) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  };

  const sorted = useMemo(() => {
    return [...(services || [])].sort((a, b) => String(a.service_id).localeCompare(String(b.service_id)));
  }, [services]);

  const updateWindow = (idx, field, value) => {
    setDraft((d) => {
      const windows = [...(d.windows || [])];
      windows[idx] = { ...windows[idx], [field]: field === 'day' ? Number(value) : value };
      return { ...d, windows };
    });
  };

  const addWindow = () => {
    setDraft((d) => ({ ...d, windows: [...(d.windows || []), { day: 1, start: '09:00', end: '19:00' }] }));
  };

  const removeWindow = (idx) => {
    setDraft((d) => ({ ...d, windows: (d.windows || []).filter((_, i) => i !== idx) }));
  };

  const save = async () => {
    if (!draft?.service_id) return;
    setBusy(true);
    setSaveMsg('');
    try {
      const r = await adminHubFetch('update_service_schedule', draft, pin);
      if (r?.error) throw new Error(r.error);
      setDraft({ ...r.schedule, windows: [...(r.schedule?.windows || [])] });
      setSaveMsg('Schedule saved — applies to all vendors for this service');
    } catch (e) {
      setSaveMsg(e.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  if (loadErr && !services) {
    return <div style={{ ...S.card(), padding: 16, color: C.red, fontSize: 12 }}>{loadErr}</div>;
  }

  if (!services) {
    return <div style={{ fontSize: 11, color: C.dim, display: 'flex', gap: 8, padding: 16 }}><Spin size={14} /> Loading schedule files…</div>;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 280px) 1fr', gap: 14, alignItems: 'start' }}>
      <div style={{ ...S.card(), padding: 12, maxHeight: '72vh', overflowY: 'auto' }}>
        <div style={{ fontWeight: 800, fontSize: 13, color: C.txt, marginBottom: 8 }}>Services ({sorted.length})</div>
        <div style={{ fontSize: 10, color: C.dim, marginBottom: 10, lineHeight: 1.5 }}>Main service → sub-service · IST · all vendors</div>
        {grouped.map((group) => {
          const open = expandedParents.has(group.parentId);
          return (
            <div key={group.parentId} style={{ marginBottom: 10 }}>
              <button
                type="button"
                onClick={() => toggleParent(group.parentId)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  width: '100%',
                  textAlign: 'left',
                  padding: '7px 8px',
                  marginBottom: 4,
                  borderRadius: 8,
                  border: `1px solid ${C.bdr}`,
                  background: C.deep,
                  color: C.txt,
                  cursor: 'pointer',
                  fontFamily: FF,
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                <span style={{ color: C.acc, width: 12, flexShrink: 0 }}>{open ? '▼' : '▶'}</span>
                <span style={{ flex: 1, lineHeight: 1.35 }}>{group.parentName}</span>
                <span style={{ fontSize: 10, color: C.dim, fontWeight: 600 }}>{group.services.length}</span>
              </button>
              {open && group.services.map((s) => (
                <button
                  key={s.service_id}
                  type="button"
                  onClick={() => setSelectedId(s.service_id)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '7px 10px 7px 22px',
                    marginBottom: 3,
                    borderRadius: 8,
                    border: `1px solid ${selectedId === s.service_id ? C.acc : C.bdr}`,
                    background: selectedId === s.service_id ? `${C.acc}14` : C.surf,
                    color: C.txt,
                    cursor: 'pointer',
                    fontFamily: FF,
                    fontSize: 11,
                  }}
                >
                  <div style={{ fontWeight: 700, lineHeight: 1.35 }}>{s.service_name || s.service_id}</div>
                  <div style={{ fontSize: 10, color: C.dim }}>
                    {s.service_id} · {s.enforce_schedule ? 'Enforced' : 'Excluded'} · {s.min_lead_minutes}m lead
                  </div>
                </button>
              ))}
            </div>
          );
        })}
      </div>

      <div style={{ ...S.card(), padding: 16 }}>
        {!draft ? (
          <div style={{ color: C.dim, fontSize: 12 }}>{busy ? 'Loading…' : 'Select a service'}</div>
        ) : (
          <>
            <div style={{ fontWeight: 800, fontSize: 16, color: C.txt, marginBottom: 4 }}>{serviceName}</div>
            <div style={{ fontSize: 11, color: C.dim, marginBottom: 14 }}>{draft.service_id} · min booking = now + {draft.min_lead_minutes} min</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: C.sub }}>
                Min lead (minutes)
                <input type="number" min={0} max={240} value={draft.min_lead_minutes} onChange={(e) => setDraft({ ...draft, min_lead_minutes: Number(e.target.value) })} style={{ ...S.inp(), marginTop: 4 }} />
              </label>
              <label style={{ fontSize: 11, color: C.sub }}>
                Slot size (minutes)
                <input type="number" min={5} max={240} step={5} value={draft.slot_minutes} onChange={(e) => setDraft({ ...draft, slot_minutes: Number(e.target.value) })} style={{ ...S.inp(), marginTop: 4 }} />
              </label>
            </div>

            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: C.txt, marginBottom: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={draft.enforce_schedule !== false} onChange={(e) => setDraft({ ...draft, enforce_schedule: e.target.checked })} />
              Enforce schedule (uncheck to exclude — bookings allowed any time after min lead)
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: C.txt, marginBottom: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!draft.allow_outside_schedule} onChange={(e) => setDraft({ ...draft, allow_outside_schedule: e.target.checked })} disabled={draft.enforce_schedule === false} />
              Allow customer override when outside hours (checkbox at booking)
            </label>

            <div style={{ fontWeight: 700, fontSize: 12, color: C.txt, marginBottom: 8 }}>Weekly windows (IST)</div>
            {(draft.windows || []).map((w, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr auto', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                <select value={w.day} onChange={(e) => updateWindow(idx, 'day', e.target.value)} style={S.inp()}>
                  {DAY_LABELS.map((l, d) => <option key={d} value={d}>{l}</option>)}
                </select>
                <input type="time" value={w.start} onChange={(e) => updateWindow(idx, 'start', e.target.value)} style={S.inp()} />
                <input type="time" value={w.end} onChange={(e) => updateWindow(idx, 'end', e.target.value)} style={S.inp()} />
                <button type="button" onClick={() => removeWindow(idx)} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 16 }}>×</button>
              </div>
            ))}
            <button type="button" onClick={addWindow} style={{ background: 'none', border: `1px dashed ${C.bdr}`, borderRadius: 8, padding: '6px 10px', color: C.acc, cursor: 'pointer', fontSize: 11, marginBottom: 12 }}>+ Add window</button>

            <label style={{ fontSize: 11, color: C.sub, display: 'block', marginBottom: 12 }}>
              Notes (internal)
              <textarea value={draft.notes || ''} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={2} style={{ ...S.inp(), marginTop: 4, resize: 'vertical' }} />
            </label>

            {saveMsg && <div style={{ fontSize: 11, color: saveMsg.includes('failed') || saveMsg.includes('Could') ? C.red : C.grn, marginBottom: 10 }}>{saveMsg}</div>}
            <Btn onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save schedule file'}</Btn>
          </>
        )}
      </div>
    </div>
  );
}

export function ScheduleBookingPanel({
  serviceId,
  schedule,
  date,
  time,
  onDate,
  onTime,
  outsideOk,
  onOutsideOk,
  validation,
  onUseNext,
  children,
  C,
  S,
  FF,
  Btn,
  Field,
  Spin,
}) {
  const next = validation?.next;
  return (
    <>
      <div style={{ background: C.deep, border: `1px solid ${C.bdr}`, borderRadius: 10, padding: '10px 12px', marginBottom: 14, fontSize: 11, color: C.sub, lineHeight: 1.55 }}>
        Pick when the partner should arrive · earliest slot is <strong style={{ color: C.txt }}>now + {schedule?.min_lead_minutes ?? 30} min</strong> (IST)
        {schedule?.enforce_schedule === false ? ' · Schedule excluded for this service' : ''}
      </div>
      <Field label="Date" req>
        <input type="date" value={date || ''} min={new Date().toISOString().slice(0, 10)} onChange={(e) => onDate(e.target.value)} style={S.inp()} />
      </Field>
      <Field label="Time" req>
        <input type="time" value={time || ''} onChange={(e) => onTime(e.target.value)} style={S.inp()} step={schedule?.slot_minutes ? schedule.slot_minutes * 60 : 1800} />
      </Field>
      {validation && !validation.ok && (
        <div style={{ ...S.card({ marginBottom: 12, padding: 12, border: `1.5px solid ${C.gold}` }) }}>
          <div style={{ fontSize: 12, color: C.txt, fontWeight: 700, marginBottom: 6 }}>{validation.message}</div>
          {next && (
            <Btn sm v="outline" onClick={() => onUseNext(next)} style={{ marginBottom: 8 }}>
              Use next available · {next.date} {next.time}
            </Btn>
          )}
          {validation.canOverride && (
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, color: C.sub, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!outsideOk} onChange={(e) => onOutsideOk(e.target.checked)} />
              Book outside available hours anyway
            </label>
          )}
        </div>
      )}
      {validation?.ok && validation.outsideSchedule && (
        <div style={{ fontSize: 11, color: C.gold, marginBottom: 10, fontWeight: 600 }}>Outside standard hours — partner will confirm</div>
      )}
      {children}
    </>
  );
}
