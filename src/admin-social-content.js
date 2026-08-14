/** Admin — social media content calendar, videos, stories, emotional posts. */
import { useState, useEffect } from 'react';

const TYPE_LABELS = {
  post: 'Post',
  video: 'Video',
  reel: 'Reel',
  short: 'Short',
  story: 'Story',
  carousel: 'Carousel',
  emotional_story: 'Emotional',
  campaign: 'Campaign',
};

const TYPE_COLOR = {
  post: '#2563EB',
  video: '#7C3AED',
  reel: '#DB2777',
  short: '#DC2626',
  story: '#D97706',
  carousel: '#0891B2',
  emotional_story: '#BE185D',
  campaign: '#059669',
};

const PLATFORM_LABELS = {
  all: 'All',
  facebook: 'Facebook',
  instagram: 'IG',
  threads: 'Threads',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  youtube_shorts: 'Shorts',
};

const STATUS_LABELS = {
  planned: 'Planned',
  drafted: 'Drafted',
  scheduled: 'Scheduled',
  posted: 'Posted',
  skipped: 'Skipped',
};

const STATUS_OPTIONS = Object.keys(STATUS_LABELS);

function fmtDt(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function StatPill({ label, value, warn, C }) {
  return (
    <div style={{ padding: '10px 14px', borderRadius: 12, background: warn ? `${C.red}12` : C.surf, border: `1px solid ${warn ? C.red : C.bdr}`, minWidth: 90 }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: warn ? C.red : C.txt }}>{value}</div>
      <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function PostEverywherePanel({ bundle, videoBundle, platforms, progress, busy, onCopy, onMarkPlatform, onMarkAll, C, S, FF, Btn }) {
  if (!bundle) {
    return (
      <div style={{ ...S.card(), padding: 16, marginBottom: 14, border: `1.5px solid ${C.gold}` }}>
        <div style={{ fontWeight: 800, color: C.txt }}>Post everywhere today</div>
        <div style={{ fontSize: 11, color: C.dim, marginTop: 6 }}>Set week start date — no daily bundle for today.</div>
      </div>
    );
  }

  const pct = progress?.total ? Math.round((progress.posted / progress.total) * 100) : 0;
  const ps = bundle.platform_status || {};

  return (
    <div style={{ ...S.card(), padding: 16, marginBottom: 14, border: `2px solid ${progress?.complete ? C.green : C.gold}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 800, color: C.txt, fontSize: 15 }}>Post everywhere today — 🚀 COMING SOON</div>
          <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>{bundle.title} · FB · IG · Threads · YT · Shorts · register now, launch first</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: progress?.complete ? C.green : C.acc }}>
            {progress?.posted || 0}/{progress?.total || 5}
          </div>
          <div style={{ fontSize: 10, color: C.dim }}>{pct}% complete</div>
        </div>
      </div>

      <div style={{ height: 6, borderRadius: 3, background: C.bdr, marginBottom: 12, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: progress?.complete ? C.green : C.acc, transition: 'width 0.3s' }} />
      </div>

      {bundle.caption ? (
        <div style={{ fontSize: 12, color: C.txt, lineHeight: 1.6, marginBottom: 10, padding: 12, background: C.deep, borderRadius: 8, border: `1px solid ${C.bdr}`, whiteSpace: 'pre-wrap' }}>
          {bundle.caption}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <Btn sm type="button" disabled={busy} onClick={() => onCopy(bundle.caption || bundle.title)}>Copy caption</Btn>
        <Btn v="outline" sm type="button" disabled={busy || progress?.complete} onClick={() => onMarkAll(bundle.id)}>Mark all 5 posted</Btn>
        {videoBundle ? (
          <span style={{ fontSize: 10, color: C.dim, alignSelf: 'center' }}>+ video: {videoBundle.title}</span>
        ) : null}
      </div>

      {(platforms || []).map((p) => {
        const done = ps[p.id]?.posted;
        return (
          <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '24px minmax(0,1fr) minmax(0,1.2fr) auto auto', gap: 8, alignItems: 'center', padding: '8px 0', borderTop: `1px solid ${C.bdr}` }}>
            <span style={{ fontSize: 14 }}>{done ? '✓' : '○'}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, color: done ? C.green : C.txt }}>{p.label}</div>
              {done && ps[p.id]?.posted_at ? (
                <div style={{ fontSize: 9, color: C.dim }}>{fmtDt(ps[p.id].posted_at)}</div>
              ) : null}
            </div>
            <input
              defaultValue={ps[p.id]?.url || ''}
              placeholder="Post URL (optional)"
              id={`plat-url-${p.id}`}
              style={{ fontSize: 10, padding: '6px 8px', borderRadius: 8, border: `1px solid ${C.bdr}`, background: C.deep, color: C.txt, fontFamily: FF }}
            />
            <a href={p.studio} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: C.acc, textDecoration: 'none', whiteSpace: 'nowrap' }}>Open ↗</a>
            <Btn v="outline" sm type="button" disabled={busy} onClick={() => {
              const el = document.getElementById(`plat-url-${p.id}`);
              onMarkPlatform(bundle.id, p.id, el?.value || '');
            }}>
              {done ? 'Update' : 'Posted'}
            </Btn>
          </div>
        );
      })}
    </div>
  );
}

function ContentRow({ item, busy, onSave, onCopy, C, S, FF, Btn }) {
  const [url, setUrl] = useState(item.post_url || '');
  const [notes, setNotes] = useState(item.notes || '');
  const [status, setStatus] = useState(item.post_status);

  useEffect(() => {
    setUrl(item.post_url || '');
    setNotes(item.notes || '');
    setStatus(item.post_status);
  }, [item.id, item.post_url, item.notes, item.post_status]);

  const typeColor = TYPE_COLOR[item.content_type] || C.acc;

  return (
    <div style={{ ...S.card(), padding: 14, marginBottom: 10, borderLeft: `4px solid ${typeColor}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: 800, color: C.txt, fontSize: 13 }}>{item.title}</div>
          <div style={{ fontSize: 10, color: C.dim, marginTop: 4 }}>
            {item.day_label} · {item.effective_date} · {PLATFORM_LABELS[item.platform] || item.platform}
            {item.script_ref ? ` · Script ${item.script_ref}` : ''}
            {item.emotional ? ' · emotional' : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 12, background: `${typeColor}18`, color: typeColor }}>
            {TYPE_LABELS[item.content_type] || item.content_type}
          </span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{ fontSize: 10, padding: '4px 8px', borderRadius: 8, border: `1px solid ${C.bdr}`, background: C.deep, color: C.txt, fontFamily: FF }}
          >
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>
      </div>

      {item.caption ? (
        <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.55, marginBottom: 8, whiteSpace: 'pre-wrap' }}>{item.caption}</div>
      ) : null}
      {item.format_notes ? (
        <div style={{ fontSize: 10, color: C.dim, marginBottom: 8 }}>Format: {item.format_notes}</div>
      ) : null}

      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'minmax(0,1fr) auto auto auto', alignItems: 'center' }}>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Post URL after publishing"
          style={{ fontSize: 11, padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.bdr}`, background: C.deep, color: C.txt, fontFamily: FF }}
        />
        <Btn v="outline" sm type="button" disabled={busy} onClick={() => onCopy(item.caption || item.title)}>Copy</Btn>
        <Btn v="outline" sm type="button" disabled={busy} onClick={() => onSave(item.id, { post_status: status, post_url: url, notes })}>Save</Btn>
        <Btn sm type="button" disabled={busy} onClick={() => onSave(item.id, { mark_posted: true, post_url: url, notes, post_status: 'posted' })}>Mark posted</Btn>
      </div>
      {item.posted_at ? (
        <div style={{ fontSize: 10, color: C.green, marginTop: 6 }}>Posted {fmtDt(item.posted_at)}</div>
      ) : null}
    </div>
  );
}

export function AdminSocialContentTab({ pin, adminHubFetch, C, S, FF, Spin, Btn }) {
  const [data, setData] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [msg, setMsg] = useState('');
  const [view, setView] = useState('today');
  const [weekStart, setWeekStart] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('emotional_story');
  const [newDay, setNewDay] = useState(1);

  const load = async () => {
    setLoading(true);
    setLoadErr('');
    try {
      const r = await adminHubFetch('get_social_dashboard', {}, pin);
      if (r.error) throw new Error(r.error);
      setData(r);
      setWeekStart(r.config?.week_start_date || '');
    } catch (e) {
      setLoadErr(e.message || 'Could not load social dashboard');
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
      await adminHubFetch('update_social_content', { id, ...patch }, pin);
      setMsg('Saved');
      await load();
    } catch (e) {
      setMsg(e.message || 'Save failed');
    } finally {
      setBusyId('');
    }
  };

  const saveWeekStart = async () => {
    setBusyId('config');
    setMsg('');
    try {
      await adminHubFetch('update_social_config', { week_start_date: weekStart }, pin);
      setMsg('Week start updated');
      await load();
    } catch (e) {
      setMsg(e.message || 'Config save failed');
    } finally {
      setBusyId('');
    }
  };

  const addItem = async () => {
    if (!newTitle.trim()) return;
    setBusyId('add');
    setMsg('');
    try {
      await adminHubFetch('add_social_content', {
        title: newTitle.trim(),
        content_type: newType,
        day_number: newDay,
        emotional: newType === 'emotional_story',
        platform: newType === 'short' ? 'youtube_shorts' : 'instagram',
      }, pin);
      setNewTitle('');
      setMsg('Added');
      await load();
    } catch (e) {
      setMsg(e.message || 'Add failed');
    } finally {
      setBusyId('');
    }
  };

  const copy = (text) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setMsg('Copied to clipboard');
  };

  const markPlatform = async (id, platform, url) => {
    setBusyId(id);
    setMsg('');
    try {
      await adminHubFetch('update_social_platform', { id, platform, posted: true, url: url || undefined }, pin);
      setMsg(`${platform} marked posted`);
      await load();
    } catch (e) {
      setMsg(e.message || 'Update failed');
    } finally {
      setBusyId('');
    }
  };

  const markAllEverywhere = async (id) => {
    setBusyId(id);
    setMsg('');
    try {
      await adminHubFetch('mark_social_everywhere', { id }, pin);
      setMsg('All 5 platforms marked posted');
      await load();
    } catch (e) {
      setMsg(e.message || 'Mark all failed');
    } finally {
      setBusyId('');
    }
  };

  if (loading && !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, color: C.dim, fontSize: 11 }}>
        <Spin size={16} /> Loading social dashboard…
      </div>
    );
  }

  if (loadErr && !data) {
    return (
      <div style={{ ...S.card(), padding: 16, color: C.red, fontSize: 12 }}>
        {loadErr}
        <div style={{ fontSize: 11, color: C.dim, marginTop: 8 }}>
          Run migration <code>20260816000005_social_content_dashboard.sql</code>
        </div>
      </div>
    );
  }

  const s = data?.summary || {};
  const cfg = data?.config || {};
  const todayQueue = data?.today_queue || [];
  const emotional = data?.emotional_stories || [];
  const videos = data?.videos || [];
  const stories = data?.stories || [];
  const byDay = data?.by_day || {};

  const viewItems = (() => {
    if (view === 'today') return todayQueue;
    if (view === 'emotional') return emotional;
    if (view === 'campaign') return (data?.items || []).filter((i) => i.content_type === 'campaign');
    if (view === 'videos') return videos;
    if (view === 'stories') return stories;
    if (view === 'week') return data?.items || [];
    return todayQueue;
  })();

  const pill = (active) => ({
    padding: '6px 12px',
    borderRadius: 20,
    border: `1.5px solid ${active ? C.acc : C.bdr}`,
    background: active ? `${C.acc}18` : C.surf,
    color: active ? C.acc : C.sub,
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: FF,
  });

  return (
    <div>
      <div style={{ ...S.card(), padding: 16, marginBottom: 14, border: `1.5px solid ${C.acc}44` }}>
        <div style={{ fontWeight: 800, color: C.txt, marginBottom: 6 }}>Social media dashboard — @{cfg.handle || 'scanvapp'} · 🚀 COMING SOON</div>
        <div style={{ fontSize: 11, color: C.sub, lineHeight: 1.55, marginBottom: 12 }}>
          Track daily posts, Reels/Shorts, Stories, and emotional content. Post only 9:30 AM – 7 PM IST.
          Kit: <code>docs/social/</code> · Schedule via Meta Business Suite.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <StatPill label="Everywhere today" value={`${s.everywhere_posted || 0}/${s.everywhere_total || 5}`} warn={!s.everywhere_complete && (s.everywhere_posted || 0) < 5} C={C} />
          <StatPill label="Due today" value={s.due_today || 0} warn={s.due_today > 0} C={C} />
          <StatPill label="Streak (days)" value={s.streak_days || 0} C={C} />
          <StatPill label="Stories pending" value={s.stories_pending || 0} C={C} />
          <StatPill label="Emotional pending" value={s.emotional_pending || 0} C={C} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ fontSize: 10, color: C.dim }}>Week 1 start (IST):</label>
          <input
            type="date"
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
            style={{ fontSize: 11, padding: '6px 8px', borderRadius: 8, border: `1px solid ${C.bdr}`, background: C.deep, color: C.txt, fontFamily: FF }}
          />
          <Btn v="outline" sm type="button" disabled={busyId === 'config'} onClick={saveWeekStart}>Set week start</Btn>
          {cfg.today_day_number ? (
            <span style={{ fontSize: 10, color: C.acc, fontWeight: 700 }}>
              Today = Day {cfg.today_day_number}{cfg.calendar_week > 1 ? ` (week ${cfg.calendar_week})` : ''} · themes repeat every 7 days
            </span>
          ) : null}
          <a href="https://business.facebook.com/" target="_blank" rel="noreferrer" style={{ fontSize: 10, color: C.acc, marginLeft: 'auto' }}>Meta Business Suite ↗</a>
        </div>
        {msg ? <div style={{ fontSize: 11, color: C.green, marginTop: 8 }}>{msg}</div> : null}
      </div>

      <PostEverywherePanel
        bundle={data?.today_everywhere}
        videoBundle={data?.today_video_everywhere}
        platforms={data?.everywhere_platforms}
        progress={data?.everywhere_progress}
        busy={!!busyId}
        onCopy={copy}
        onMarkPlatform={markPlatform}
        onMarkAll={markAllEverywhere}
        C={C}
        S={S}
        FF={FF}
        Btn={Btn}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {[
          ['today', `Today (${todayQueue.length})`],
          ['week', 'Full week'],
          ['videos', `Videos (${videos.length})`],
          ['stories', `Stories (${stories.length})`],
          ['emotional', `Emotional (${emotional.length})`],
          ['campaign', `Campaign (${(data?.items || []).filter((i) => i.content_type === 'campaign').length})`],
        ].map(([id, label]) => (
          <button key={id} type="button" onClick={() => setView(id)} style={pill(view === id)}>{label}</button>
        ))}
      </div>

      {view === 'week' ? (
        Object.keys(byDay).sort((a, b) => Number(a) - Number(b)).map((day) => (
          <div key={day} style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 800, color: C.txt, fontSize: 13, marginBottom: 8 }}>
              Day {day}
              {Number(day) === cfg.today_day_number ? ' · TODAY' : ''}
            </div>
            {(byDay[day] || []).map((item) => (
              <ContentRow key={item.id} item={item} busy={busyId === item.id} onSave={save} onCopy={copy} C={C} S={S} FF={FF} Btn={Btn} />
            ))}
          </div>
        ))
      ) : (
        viewItems.map((item) => (
          <ContentRow key={item.id} item={item} busy={busyId === item.id} onSave={save} onCopy={copy} C={C} S={S} FF={FF} Btn={Btn} />
        ))
      )}

      <div style={{ ...S.card(), padding: 16, marginTop: 14 }}>
        <div style={{ fontWeight: 800, color: C.txt, marginBottom: 8 }}>Add custom content</div>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'minmax(0,2fr) auto auto auto auto', alignItems: 'center' }}>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Title — e.g. Emotional — vendor thank you"
            style={{ fontSize: 11, padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.bdr}`, background: C.deep, color: C.txt, fontFamily: FF }}
          />
          <select value={newType} onChange={(e) => setNewType(e.target.value)} style={{ fontSize: 10, padding: '6px 8px', borderRadius: 8, border: `1px solid ${C.bdr}`, background: C.deep, color: C.txt, fontFamily: FF }}>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={newDay} onChange={(e) => setNewDay(Number(e.target.value))} style={{ fontSize: 10, padding: '6px 8px', borderRadius: 8, border: `1px solid ${C.bdr}`, background: C.deep, color: C.txt, fontFamily: FF }}>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={d}>Day {d}</option>)}
          </select>
          <Btn sm type="button" disabled={busyId === 'add'} onClick={addItem}>Add</Btn>
        </div>
      </div>
    </div>
  );
}
