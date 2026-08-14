/** Admin-only diagram viewer — Mermaid data fetched from admin-hub after PIN auth (not in public bundle). */
import { useState, useEffect, useRef } from 'react';

export function AdminDiagramsTab({ pin, adminHubFetch, C, S, FF, Spin }) {
  const [sections, setSections] = useState(null);
  const [section, setSection] = useState('architecture');
  const [diagramId, setDiagramId] = useState('');
  const hostRef = useRef(null);
  const [err, setErr] = useState('');
  const [loadErr, setLoadErr] = useState('');
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    if (!pin || !adminHubFetch) return;
    let cancelled = false;
    setLoadErr('');
    setSections(null);
    adminHubFetch('get_admin_diagrams', {}, pin)
      .then((r) => {
        if (cancelled) return;
        if (r?.error) throw new Error(r.error);
        if (!Array.isArray(r?.sections) || !r.sections.length) throw new Error('No diagrams returned');
        setSections(r.sections);
        setSection(r.sections[0].id);
        setDiagramId(r.sections[0].diagrams[0]?.id || '');
      })
      .catch((e) => {
        if (!cancelled) setLoadErr(e.message || 'Could not load diagrams');
      });
    return () => { cancelled = true; };
  }, [pin, adminHubFetch]);

  const flat = sections
    ? sections.flatMap((s) => s.diagrams.map((d) => ({ ...d, sectionId: s.id, sectionLabel: s.label })))
    : [];
  const sectionDef = sections?.find((s) => s.id === section) || sections?.[0];
  const diagram = flat.find((d) => d.id === diagramId) || sectionDef?.diagrams?.[0];

  useEffect(() => {
    if (sectionDef && !sectionDef.diagrams.some((d) => d.id === diagramId)) {
      setDiagramId(sectionDef.diagrams[0]?.id || '');
    }
  }, [section, diagramId, sectionDef]);

  useEffect(() => {
    if (!diagram?.mermaid) return;
    let cancelled = false;
    setErr('');
    setRendering(true);
    const run = async () => {
      try {
        if (!window.mermaid) {
          await new Promise((resolve, reject) => {
            const existing = document.querySelector('script[data-scanv-mermaid]');
            if (existing) {
              if (window.mermaid) resolve();
              else existing.addEventListener('load', resolve);
              return;
            }
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
            s.dataset.scanvMermaid = '1';
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
          });
          window.mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose' });
        }
        if (cancelled || !hostRef.current || !diagram) return;
        hostRef.current.innerHTML = '';
        const el = document.createElement('div');
        el.className = 'mermaid';
        el.textContent = diagram.mermaid;
        hostRef.current.appendChild(el);
        await window.mermaid.run({ nodes: [el] });
      } catch (e) {
        if (!cancelled) setErr(e.message || 'Could not render diagram');
      } finally {
        if (!cancelled) setRendering(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [diagram?.id, diagram?.mermaid]);

  const chipBtn = (active) => ({
    padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${active ? C.acc : C.bdr}`,
    background: active ? `${C.acc}18` : C.surf, color: active ? C.acc : C.sub,
    fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: FF,
  });

  if (loadErr) {
    return (
      <div style={{ ...S.card(), padding: 16, color: C.red, fontSize: 12 }}>
        Could not load confidential diagrams: {loadErr}
      </div>
    );
  }

  if (!sections) {
    return (
      <div style={{ fontSize: 11, color: C.dim, display: 'flex', alignItems: 'center', gap: 8, padding: 16 }}>
        <Spin size={14} /> Loading diagrams…
      </div>
    );
  }

  return (
    <div>
      <div style={{ ...S.card(), padding: 16, marginBottom: 14, border: `1.5px solid ${C.gold}` }}>
        <div style={{ fontWeight: 800, color: C.txt, marginBottom: 6 }}>Confidential — Admin only</div>
        <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.6 }}>
          {flat.length} diagrams loaded from server after PIN verification. Not in the public app bundle.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {sections.map((s) => (
          <button key={s.id} type="button" style={chipBtn(section === s.id)} onClick={() => { setSection(s.id); setDiagramId(s.diagrams[0]?.id || ''); }}>
            {s.label} ({s.diagrams.length})
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {(sectionDef?.diagrams || []).map((d) => (
          <button key={d.id} type="button" style={chipBtn(diagramId === d.id)} onClick={() => setDiagramId(d.id)}>
            {d.title}
          </button>
        ))}
      </div>

      {diagram && (
        <div style={{ ...S.card(), padding: 16, marginBottom: 12 }}>
          <div style={{ fontWeight: 800, color: C.txt, fontSize: 15, marginBottom: 4 }}>{diagram.title}</div>
          <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.55, marginBottom: 8 }}>{diagram.desc}</div>
          <div style={{ fontSize: 10, color: C.dim }}>{diagram.sectionLabel} · v5.5.3</div>
        </div>
      )}

      {err && <div style={{ color: C.red, fontSize: 12, marginBottom: 10 }}>{err}</div>}
      {rendering && <div style={{ fontSize: 11, color: C.dim, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}><Spin size={14} /> Rendering…</div>}
      <div ref={hostRef} style={{ ...S.card(), padding: 16, overflowX: 'auto', minHeight: 320 }} />
    </div>
  );
}
