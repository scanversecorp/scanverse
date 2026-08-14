/** Simple Add User panel — name, email, role, one button. */
import { useState, useEffect } from 'react';

export const STAFF_ROLE_OPTIONS = [
  { id: 'support_agent', label: 'Support Agent', hint: 'Support desk — search, tickets, cancel bookings' },
  { id: 'support_admin', label: 'Support Admin', hint: 'Support desk + edit profiles and refunds' },
  { id: 'vendor_admin', label: 'Vendor Admin', hint: 'Vendor onboarding and activation' },
  { id: 'pricing_admin', label: 'Pricing Admin', hint: 'Pricing catalog edits' },
  { id: 'hub_operator', label: 'Hub Operator', hint: 'Most admin hub tabs (not exec-only)' },
  { id: 'scanv_owner', label: 'ScanV Owner', hint: 'Full access including exec dashboard and IAM' },
];

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
  const [recent, setRecent] = useState([]);
  const [form, setForm] = useState({
    display_name: '',
    email: '',
    role_id: 'support_agent',
  });

  const canManage = iam?.permissions?.includes('hub.iam');

  const loadRecent = async () => {
    if (!canManage) {
      setReady(true);
      return;
    }
    try {
      const r = await adminHubFetch('list_staff_users', {}, pin);
      setRecent((r.staff || []).slice(0, 5));
      setLoadErr('');
      setReady(true);
    } catch (e) {
      const msg = e.message || 'Could not load staff';
      if (msg.includes('iam_roles') || msg.includes('staff_users') || msg.includes('does not exist')) {
        setLoadErr('IAM tables missing — run the migration in Supabase SQL editor first.');
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
    loadRecent();
  }, [pin, adminHubFetch, canManage]);

  const submit = async (e) => {
    e.preventDefault();
    if (!canManage) {
      onErr?.('Owner permission required (ScanV Owner role or ADMIN_HUB_PIN)');
      return;
    }
    const display_name = form.display_name.trim();
    const email = form.email.trim().toLowerCase();
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
        role_ids: [form.role_id],
        notes: `Added via Admin Add User UI · role ${form.role_id}`,
      }, pin);
      onMsg?.(`Added ${display_name} as ${STAFF_ROLE_OPTIONS.find((r) => r.id === form.role_id)?.label || form.role_id}`);
      setForm({ display_name: '', email: '', role_id: 'support_agent' });
      await loadRecent();
    } catch (err) {
      onErr?.(err.message || 'Could not add user');
    } finally {
      setSaving(false);
    }
  };

  const selectedRole = STAFF_ROLE_OPTIONS.find((r) => r.id === form.role_id);

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
          <div style={{ fontWeight: 800, color: C.txt, fontSize: compact ? 14 : 16, marginBottom: 4 }}>Add user</div>
          <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.5, maxWidth: 520 }}>
            Assign a staff role by email. They get permissions when they sign in with Supabase Auth using the same email.
            For desk-only access, also share <code style={{ color: C.acc }}>SUPPORT_AGENT_PIN</code> on <code style={{ color: C.acc }}>#customer-support</code>.
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
        <div style={{ fontSize: 11, color: C.dim, padding: 10, background: `${C.dim}08`, borderRadius: 8 }}>
          Sign in with an <strong style={{ color: C.txt }}>owner PIN</strong> (ADMIN_HUB_PIN or SUPPORT_ADMIN_PIN) to add users here.
        </div>
      ) : (
        <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
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
      )}

      {canManage && recent.length ? (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.bdr}` }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: C.dim, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Recent staff
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {recent.map((u) => (
              <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, flexWrap: 'wrap' }}>
                <span style={{ color: C.txt, fontWeight: 600 }}>{u.display_name}</span>
                <span style={{ color: C.sub }}>{u.email}</span>
                <span style={{ color: C.acc, fontSize: 10 }}>{(u.role_ids || []).join(', ') || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
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
