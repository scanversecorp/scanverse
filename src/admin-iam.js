/** Admin IAM — roles, permissions, staff assignments (PIN-gated hub tab). */
import { useState, useEffect, useMemo } from 'react';

const ROLE_COLORS = {
  scanv_owner: '#DC2626',
  hub_operator: '#2563EB',
  support_admin: '#7C3AED',
  support_agent: '#0891B2',
  pricing_admin: '#D97706',
  vendor_admin: '#059669',
};

function permGranted(permissionsByRole, roleId, permId) {
  return (permissionsByRole[roleId] || []).includes(permId);
}

export function AdminIamTab({ pin, adminHubFetch, iam, C, S, FF, Spin }) {
  const [catalog, setCatalog] = useState(null);
  const [staff, setStaff] = useState([]);
  const [loadErr, setLoadErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({
    email: '',
    display_name: '',
    role_ids: ['support_agent'],
    notes: '',
  });

  const canManage = iam?.permissions?.includes('hub.iam');

  const load = async () => {
    setLoading(true);
    setLoadErr('');
    try {
      const [cat, staffRes] = await Promise.all([
        adminHubFetch('get_iam_catalog', {}, pin),
        canManage ? adminHubFetch('list_staff_users', {}, pin) : Promise.resolve({ staff: [] }),
      ]);
      setCatalog(cat);
      setStaff(staffRes.staff || []);
    } catch (e) {
      setLoadErr(e.message || 'Could not load IAM catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!pin || !adminHubFetch) return;
    load();
  }, [pin, adminHubFetch, canManage]);

  const domains = useMemo(() => {
    const perms = catalog?.permissions || [];
    return [...new Set(perms.map((p) => p.domain))].sort();
  }, [catalog]);

  const saveStaff = async (e) => {
    e.preventDefault();
    if (!canManage) return;
    setSaving(true);
    setMsg('');
    try {
      await adminHubFetch('upsert_staff_user', form, pin);
      setMsg('Staff user saved');
      setForm({ email: '', display_name: '', role_ids: ['support_agent'], notes: '' });
      await load();
    } catch (err) {
      setMsg(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !catalog) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, color: C.dim, fontSize: 11 }}>
        <Spin size={16} /> Loading IAM catalog…
      </div>
    );
  }

  if (loadErr && !catalog) {
    return <div style={{ ...S.card(), padding: 16, color: C.red, fontSize: 12 }}>{loadErr}</div>;
  }

  const roles = catalog?.roles || [];
  const permissions = catalog?.permissions || [];
  const permissionsByRole = catalog?.permissions_by_role || {};
  const pinMap = catalog?.pin_role_map || [];

  return (
    <div>
      <div style={{ ...S.card(), padding: 16, marginBottom: 14, border: `1.5px solid ${C.acc}` }}>
        <div style={{ fontWeight: 800, color: C.txt, marginBottom: 6 }}>Roles & IAM</div>
        <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.6 }}>
          Permission matrix for ScanV staff. PIN secrets map to roles in Supabase secrets; staff JWT roles are assigned below.
          {iam?.auth_method ? ` Signed in via ${iam.auth_method}.` : ''}
          {iam?.roles?.length ? ` Your roles: ${iam.roles.join(', ')}.` : ''}
        </div>
      </div>

      {msg ? (
        <div style={{ ...S.card(), padding: 12, marginBottom: 14, color: msg.toLowerCase().includes('fail') ? C.red : C.grn, fontSize: 11 }}>{msg}</div>
      ) : null}

      <div style={{ ...S.card(), padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: C.txt, marginBottom: 10 }}>PIN → role mapping</div>
        <div style={{ fontSize: 10, color: C.dim, marginBottom: 10 }}>
          Values live in Supabase Edge Function secrets — this table shows which IAM roles each PIN grants.
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: `1px solid ${C.bdr}` }}>
                <th style={{ padding: '6px 8px' }}>Secret name</th>
                <th style={{ padding: '6px 8px' }}>IAM role</th>
                <th style={{ padding: '6px 8px' }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {pinMap.map((row) => (
                <tr key={`${row.pin_key}-${row.role_id}`} style={{ borderBottom: `1px solid ${C.bdr}` }}>
                  <td style={{ padding: '6px 8px', fontFamily: 'monospace', color: C.acc }}>{row.pin_key}</td>
                  <td style={{ padding: '6px 8px' }}>
                    <span style={{ color: ROLE_COLORS[row.role_id] || C.txt, fontWeight: 700 }}>{row.role_id}</span>
                  </td>
                  <td style={{ padding: '6px 8px', color: C.sub }}>{row.description || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ ...S.card(), padding: 16, marginBottom: 14, overflowX: 'auto' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: C.txt, marginBottom: 10 }}>Permission matrix</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9, minWidth: 720 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 6, position: 'sticky', left: 0, background: C.surf }}>Permission</th>
              {roles.map((r) => (
                <th key={r.id} style={{ padding: 6, color: ROLE_COLORS[r.id] || C.txt, minWidth: 72 }}>{r.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {domains.map((domain) => (
              permissions.filter((p) => p.domain === domain).map((p) => (
                <tr key={p.id} style={{ borderTop: `1px solid ${C.bdr}` }}>
                  <td style={{ padding: 6, position: 'sticky', left: 0, background: C.surf }}>
                    <div style={{ fontWeight: 700, color: C.txt }}>{p.id}</div>
                    <div style={{ color: C.dim }}>{p.label}</div>
                  </td>
                  {roles.map((r) => (
                    <td key={r.id} style={{ textAlign: 'center', padding: 6 }}>
                      {permGranted(permissionsByRole, r.id, p.id) ? (
                        <span style={{ color: C.grn, fontWeight: 800 }}>✓</span>
                      ) : (
                        <span style={{ color: C.dim }}>·</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))
            ))}
          </tbody>
        </table>
      </div>

      {canManage ? (
        <div style={{ ...S.card(), padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.txt, marginBottom: 10 }}>Staff users (JWT roles)</div>
          <div style={{ fontSize: 10, color: C.dim, marginBottom: 12 }}>
            Add staff by email. When they sign in with Supabase Auth using that email, edge functions grant their assigned roles.
          </div>

          <form onSubmit={saveStaff} style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <input
                required
                type="email"
                placeholder="staff@scanverse.in"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                style={{ ...S.inp(), fontSize: 11 }}
              />
              <input
                required
                placeholder="Display name"
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                style={{ ...S.inp(), fontSize: 11 }}
              />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {roles.map((r) => {
                const on = form.role_ids.includes(r.id);
                return (
                  <label key={r.id} style={{ fontSize: 10, display: 'flex', gap: 4, alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => setForm((f) => ({
                        ...f,
                        role_ids: on ? f.role_ids.filter((x) => x !== r.id) : [...f.role_ids, r.id],
                      }))}
                    />
                    <span style={{ color: ROLE_COLORS[r.id] || C.txt, fontWeight: 700 }}>{r.label}</span>
                  </label>
                );
              })}
            </div>
            <textarea
              placeholder="Notes (optional)"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              style={{ ...S.inp(), fontSize: 11, resize: 'vertical' }}
            />
            <button
              type="submit"
              disabled={saving || !form.role_ids.length}
              style={{
                padding: '8px 14px', borderRadius: 10, border: 'none', background: C.acc, color: '#fff',
                fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: FF, width: 'fit-content',
              }}
            >
              {saving ? 'Saving…' : 'Add / update staff'}
            </button>
          </form>

          <div style={{ display: 'grid', gap: 8 }}>
            {!staff.length ? <div style={{ fontSize: 11, color: C.dim }}>No staff users yet.</div> : null}
            {staff.map((u) => (
              <div key={u.id} style={{ padding: 12, borderRadius: 10, border: `1px solid ${C.bdr}`, background: `${C.acc}04` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 800, color: C.txt, fontSize: 12 }}>{u.display_name}</div>
                    <div style={{ fontSize: 10, color: C.acc }}>{u.email}</div>
                  </div>
                  <span style={{
                    fontSize: 9, fontWeight: 800, padding: '4px 8px', borderRadius: 999,
                    color: u.active ? C.grn : C.dim, background: u.active ? `${C.grn}18` : `${C.dim}18`,
                  }}>
                    {u.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(u.role_ids || []).map((rid) => (
                    <span key={rid} style={{
                      fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
                      color: ROLE_COLORS[rid] || C.txt,
                      border: `1px solid ${ROLE_COLORS[rid] || C.bdr}44`,
                    }}>
                      {rid}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 9, color: C.dim, marginTop: 6 }}>
                  {u.auth_user_id ? 'Linked to Supabase Auth' : 'Awaiting first staff login'}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ ...S.card(), padding: 16, color: C.dim, fontSize: 11 }}>
          Staff role management requires the <strong style={{ color: C.txt }}>hub.iam</strong> permission (ScanV Owner role).
        </div>
      )}
    </div>
  );
}
