/** Staff users — add, edit, role change, pause, delete. */
import { useState, useEffect } from 'react';
import { formatRoleIdsWithRank, formatRoleWithRank, sortRolesByPower } from './iam-role-ranks';

const STAFF_ROLE_DEFS = [
  { id: 'support_agent', label: 'Support Agent', hint: 'Support desk — search, tickets, cancel bookings' },
  { id: 'pricing_admin', label: 'Pricing Admin', hint: 'Pricing catalog edits' },
  { id: 'vendor_admin', label: 'Vendor Admin', hint: 'Vendor onboarding and activation' },
  { id: 'support_admin', label: 'Support Admin', hint: 'Support desk + edit profiles and refunds' },
  { id: 'hub_operator', label: 'Hub Operator', hint: 'Most admin hub tabs (not exec-only)' },
  { id: 'scanv_owner', label: 'ScanV Owner', hint: 'Full access including exec dashboard and IAM' },
];

export const STAFF_ROLE_OPTIONS = sortRolesByPower(STAFF_ROLE_DEFS).map((r) => ({
  ...r,
  label: formatRoleWithRank(r.id, r.label),
}));

function fmtDt(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export function AdminAddUserPanel({
  pin,
  adminHubFetch,
  iam,
  onMsg,
  onErr,
  onOpenIam,
  compact = false,
  C,
  S,
  FF,
  Btn,
  Spin,
}) {
  const [ready, setReady] = useState(false);
  const [loadErr, setLoadErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [staff, setStaff] = useState([]);
  const [editId, setEditId] = useState('');
  const [roleDraft, setRoleDraft] = useState({});
  const [form, setForm] = useState({
    display_name: '',
    email: '',
    phone: '',
    role_id: 'support_agent',
  });
  const [editForm, setEditForm] = useState({
    display_name: '',
    email: '',
    phone: '',
    role_id: 'support_agent',
    notes: '',
  });

  const canManage = iam?.permissions?.includes('hub.iam');
  const permCount = iam?.permissions?.length ?? 0;
  const roleLabel = (iam?.roles || []).join(', ') || iam?.pin_key || 'unknown';
  const migrationLikelyMissing = !!iam && permCount === 0 && (iam.roles?.length > 0 || iam.pin_key);
  const wrongPinForIam = !!iam && permCount > 0 && !canManage;

  const loadStaff = async () => {
    if (!canManage) {
      setReady(true);
      return;
    }
    try {
      const r = await adminHubFetch('list_staff_users', {}, pin);
      const rows = r.staff || [];
      setStaff(rows);
      setRoleDraft((prev) => {
        const next = { ...prev };
        rows.forEach((u) => {
          if (!next[u.id]) next[u.id] = (u.role_ids || [])[0] || 'support_agent';
        });
        return next;
      });
      setLoadErr('');
      setReady(true);
    } catch (e) {
      const msg = e.message || 'Could not load staff';
      if (msg.includes('phone') && msg.includes('does not exist')) {
        setLoadErr('Phone column missing — run supabase/migrations/20260816000002_staff_users_phone.sql in the Supabase SQL editor.');
      } else if (msg.includes('iam_roles') || msg.includes('staff_users') || msg.includes('does not exist')) {
        setLoadErr('IAM tables missing — run supabase/migrations/20260816000001_iam_roles.sql in the Supabase SQL editor first.');
      } else if (msg.includes('Missing permission')) {
        setLoadErr('');
        setReady(true);
      } else {
        setLoadErr(msg);
        setReady(true);
      }
    }
  };

  useEffect(() => {
    if (!pin || !adminHubFetch) return;
    loadStaff();
  }, [pin, adminHubFetch, canManage]);

  const submit = async (e) => {
    e.preventDefault();
    if (!canManage) {
      onErr?.('Owner permission required (ScanV Owner role or ADMIN_HUB_PIN)');
      return;
    }
    const display_name = form.display_name.trim();
    const email = form.email.trim().toLowerCase();
    const phone = form.phone.trim();
    if (!display_name || !email.includes('@')) {
      onErr?.('Enter name and a valid email');
      return;
    }
    setSaving(true);
    onErr?.('');
    try {
      await adminHubFetch('upsert_staff_user', {
        display_name,
        email,
        phone: phone || null,
        role_ids: [form.role_id],
        notes: `Added via Admin Add User UI · role ${form.role_id}`,
      }, pin);
      const roleLabel = STAFF_ROLE_OPTIONS.find((r) => r.id === form.role_id)?.label || form.role_id;
      onMsg?.(`Added ${display_name} as ${roleLabel}`);
      setForm({ display_name: '', email: '', phone: '', role_id: 'support_agent' });
      await loadStaff();
    } catch (err) {
      onErr?.(err.message || 'Could not add user');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (u) => {
    setEditId(u.id);
    setEditForm({
      display_name: u.display_name || '',
      email: u.email || '',
      phone: u.phone || '',
      role_id: (u.role_ids || [])[0] || 'support_agent',
      notes: u.notes || '',
    });
  };

  const cancelEdit = () => {
    setEditId('');
  };

  const saveEdit = async (u) => {
    setBusyId(u.id);
    onErr?.('');
    try {
      await adminHubFetch('upsert_staff_user', {
        staff_id: u.id,
        display_name: editForm.display_name.trim(),
        email: editForm.email.trim().toLowerCase(),
        phone: editForm.phone.trim() || null,
        role_ids: [editForm.role_id],
        notes: editForm.notes.trim() || null,
        active: u.active,
      }, pin);
      onMsg?.(`Updated ${editForm.display_name.trim()}`);
      setEditId('');
      await loadStaff();
    } catch (err) {
      onErr?.(err.message || 'Could not update user');
    } finally {
      setBusyId('');
    }
  };

  const saveRole = async (u) => {
    const role_id = roleDraft[u.id] || (u.role_ids || [])[0] || 'support_agent';
    setBusyId(u.id);
    onErr?.('');
    try {
      await adminHubFetch('upsert_staff_user', {
        staff_id: u.id,
        email: u.email,
        display_name: u.display_name,
        phone: u.phone || null,
        role_ids: [role_id],
        active: u.active,
      }, pin);
      onMsg?.(`Role updated for ${u.display_name}`);
      await loadStaff();
    } catch (err) {
      onErr?.(err.message || 'Could not change role');
    } finally {
      setBusyId('');
    }
  };

  const togglePause = async (u) => {
    setBusyId(u.id);
    onErr?.('');
    try {
      await adminHubFetch('upsert_staff_user', {
        staff_id: u.id,
        email: u.email,
        display_name: u.display_name,
        phone: u.phone || null,
        role_ids: u.role_ids || [],
        active: !u.active,
      }, pin);
      onMsg?.(`${u.display_name} ${u.active ? 'paused' : 'resumed'}`);
      await loadStaff();
    } catch (err) {
      onErr?.(err.message || 'Could not update status');
    } finally {
      setBusyId('');
    }
  };

  const deleteUser = async (u) => {
    if (!window.confirm(`Delete ${u.display_name} (${u.email})? This removes IAM roles but not their Supabase Auth account.`)) return;
    setBusyId(u.id);
    onErr?.('');
    try {
      await adminHubFetch('delete_staff_user', { staff_id: u.id }, pin);
      onMsg?.(`Deleted ${u.display_name}`);
      if (editId === u.id) setEditId('');
      await loadStaff();
    } catch (err) {
      onErr?.(err.message || 'Could not delete user');
    } finally {
      setBusyId('');
    }
  };

  const selectedRole = STAFF_ROLE_DEFS.find((r) => r.id === form.role_id);

  if (!ready && !loadErr) {
    return (
      <div style={{ ...S.card(), padding: 16, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, color: C.dim, fontSize: 11 }}>
        <Spin size={14} /> Loading…
      </div>
    );
  }

  return (
    <div style={{ ...S.card(), padding: 16, marginBottom: 14, border: `1.5px solid ${C.acc}44` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 800, color: C.txt, fontSize: compact ? 14 : 16, marginBottom: 4 }}>Staff users</div>
          <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.5, maxWidth: 560 }}>
            Add staff, change roles, pause access, or remove users. Role numbers run{' '}
            <strong style={{ color: C.txt }}>#1 (lowest)</strong> → <strong style={{ color: C.txt }}>#6 (highest)</strong>.
            JWT permissions apply when they sign in with the same email via Supabase Auth.
          </div>
        </div>
        {onOpenIam ? (
          <button
            type="button"
            onClick={onOpenIam}
            style={{
              padding: '6px 12px', borderRadius: 999, border: `1px solid ${C.bdr}`, background: C.surf,
              color: C.acc, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: FF,
            }}
          >
            Full IAM matrix →
          </button>
        ) : null}
      </div>

      {loadErr ? (
        <div style={{ fontSize: 11, color: C.gold, marginBottom: 12, padding: 10, background: `${C.gold}12`, borderRadius: 8 }}>
          {loadErr}
        </div>
      ) : null}

      {!canManage ? (
        <div style={{ fontSize: 11, color: C.dim, padding: 10, background: `${C.dim}08`, borderRadius: 8, lineHeight: 1.55 }}>
          {migrationLikelyMissing ? (
            <>
              <strong style={{ color: C.gold }}>IAM migration not applied yet.</strong> Run the SQL from{' '}
              <code style={{ color: C.acc }}>supabase/migrations/20260816000001_iam_roles.sql</code> in the{' '}
              <a href="https://supabase.com/dashboard/project/rwlwrmmqtedugcreweut/sql/new" target="_blank" rel="noreferrer" style={{ color: C.acc }}>
                Supabase SQL editor
              </a>
              , then click <strong style={{ color: C.txt }}>Lock</strong> and unlock again with your owner PIN.
            </>
          ) : wrongPinForIam ? (
            <>
              Your current PIN (<code style={{ color: C.acc }}>{roleLabel}</code>) does not include IAM admin access.
              Click <strong style={{ color: C.txt }}>Lock</strong> and unlock with <strong style={{ color: C.txt }}>ADMIN_HUB_PIN</strong> or{' '}
              <strong style={{ color: C.txt }}>SUPPORT_ADMIN_PIN</strong>.
            </>
          ) : (
            <>
              Sign in with an <strong style={{ color: C.txt }}>owner PIN</strong> (ADMIN_HUB_PIN or SUPPORT_ADMIN_PIN) to manage staff here.
              If you already did, click <strong style={{ color: C.txt }}>Lock</strong> and unlock again to refresh permissions.
            </>
          )}
        </div>
      ) : (
        <>
          <form onSubmit={submit} style={{ display: 'grid', gap: 12, marginBottom: 18, paddingBottom: 18, borderBottom: `1px solid ${C.bdr}` }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.txt }}>Add user</div>
            <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
              <Field label="Full name" C={C} S={S} FF={FF}>
                <input
                  required
                  value={form.display_name}
                  onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                  placeholder="e.g. Priya Sharma"
                  style={S.inp()}
                />
              </Field>
              <Field label="Email (login)" C={C} S={S} FF={FF}>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="agent@company.com"
                  style={S.inp()}
                />
              </Field>
              <Field label="Phone" C={C} S={S} FF={FF}>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+91 98765 43210"
                  style={S.inp()}
                />
              </Field>
              <Field label="Role" C={C} S={S} FF={FF}>
                <select
                  value={form.role_id}
                  onChange={(e) => setForm((f) => ({ ...f, role_id: e.target.value }))}
                  style={{ ...S.inp(), cursor: 'pointer' }}
                >
                  {STAFF_ROLE_OPTIONS.map((r) => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
              </Field>
            </div>
            {selectedRole?.hint ? (
              <div style={{ fontSize: 10, color: C.dim, marginTop: -4 }}>{selectedRole.hint}</div>
            ) : null}
            <div>
              <Btn type="submit" disabled={saving}>
                {saving ? 'Adding…' : 'Add user'}
              </Btn>
            </div>
          </form>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.txt }}>
              Staff directory ({staff.length})
            </div>
            <Btn v="outline" sm type="button" onClick={loadStaff} disabled={!!busyId}>Reload</Btn>
          </div>

          {!staff.length ? (
            <div style={{ fontSize: 11, color: C.dim, padding: 16, textAlign: 'center' }}>No staff users yet.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {staff.map((u) => {
                const isEditing = editId === u.id;
                const isBusy = busyId === u.id;
                const currentRole = (u.role_ids || [])[0] || 'support_agent';
                return (
                  <div
                    key={u.id}
                    style={{
                      ...S.card(),
                      padding: 14,
                      opacity: u.active ? 1 : 0.7,
                      border: `1px solid ${u.active ? C.bdr : `${C.dim}66`}`,
                    }}
                  >
                    {isEditing ? (
                      <div style={{ display: 'grid', gap: 10 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                          <Field label="Full name" C={C} S={S} FF={FF}>
                            <input value={editForm.display_name} onChange={(e) => setEditForm((f) => ({ ...f, display_name: e.target.value }))} style={S.inp()} />
                          </Field>
                          <Field label="Email" C={C} S={S} FF={FF}>
                            <input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} style={S.inp()} />
                          </Field>
                          <Field label="Phone" C={C} S={S} FF={FF}>
                            <input type="tel" value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} style={S.inp()} />
                          </Field>
                          <Field label="Role" C={C} S={S} FF={FF}>
                            <select value={editForm.role_id} onChange={(e) => setEditForm((f) => ({ ...f, role_id: e.target.value }))} style={{ ...S.inp(), cursor: 'pointer' }}>
                              {STAFF_ROLE_OPTIONS.map((r) => (
                                <option key={r.id} value={r.id}>{r.label}</option>
                              ))}
                            </select>
                          </Field>
                        </div>
                        <Field label="Notes" C={C} S={S} FF={FF}>
                          <input value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} style={S.inp()} placeholder="Shift, team, desk access notes…" />
                        </Field>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <Btn sm type="button" onClick={() => saveEdit(u)} disabled={isBusy}>{isBusy ? 'Saving…' : 'Save changes'}</Btn>
                          <Btn v="outline" sm type="button" onClick={cancelEdit} disabled={isBusy}>Cancel</Btn>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 800, color: C.txt, fontSize: 14 }}>{u.display_name}</div>
                            <div style={{ fontSize: 11, color: C.acc, marginTop: 2 }}>{u.email}</div>
                            <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>Phone: {u.phone || '—'}</div>
                            <div style={{ fontSize: 10, color: C.dim, marginTop: 6 }}>
                              Role: {formatRoleIdsWithRank(u.role_ids) || '—'}
                              {u.auth_user_id ? ' · Linked to Supabase Auth' : ' · Awaiting first login'}
                            </div>
                            <div style={{ fontSize: 9, color: C.dim, marginTop: 4 }}>Added {fmtDt(u.created_at)}</div>
                            {u.notes ? <div style={{ fontSize: 10, color: C.dim, marginTop: 4 }}>{u.notes}</div> : null}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                            <StatusBadge active={u.active} C={C} />
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.bdr}` }}>
                          <select
                            value={roleDraft[u.id] || currentRole}
                            onChange={(e) => setRoleDraft((d) => ({ ...d, [u.id]: e.target.value }))}
                            style={{ ...S.inp(), fontSize: 10, padding: '6px 8px', cursor: 'pointer', minWidth: 160 }}
                            disabled={isBusy}
                          >
                            {STAFF_ROLE_OPTIONS.map((r) => (
                              <option key={r.id} value={r.id}>{r.label}</option>
                            ))}
                          </select>
                          <Btn v="outline" sm type="button" onClick={() => saveRole(u)} disabled={isBusy || (roleDraft[u.id] || currentRole) === currentRole}>
                            Change role
                          </Btn>
                          <Btn v="outline" sm type="button" onClick={() => startEdit(u)} disabled={isBusy}>Edit</Btn>
                          <Btn v={u.active ? 'outline' : 'ghost'} sm type="button" onClick={() => togglePause(u)} disabled={isBusy}>
                            {u.active ? 'Pause' : 'Resume'}
                          </Btn>
                          <Btn v="danger" sm type="button" onClick={() => deleteUser(u)} disabled={isBusy}>Delete</Btn>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatusBadge({ active, C }) {
  return (
    <span style={{
      fontSize: 9,
      fontWeight: 800,
      padding: '4px 10px',
      borderRadius: 999,
      color: active ? C.grn : C.gold,
      background: active ? `${C.grn}18` : `${C.gold}18`,
    }}
    >
      {active ? 'Active' : 'Paused'}
    </span>
  );
}

function Field({ label, children, C, S, FF }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.dim, marginBottom: 4, fontFamily: FF }}>{label}</div>
      {children}
    </div>
  );
}
