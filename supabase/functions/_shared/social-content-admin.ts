/** ScanV social content calendar + daily posting dashboard (admin-hub). */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const IST = "Asia/Kolkata";

function istYmd(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function dayNumberForDate(weekStart: string, ymd: string): number {
  const start = new Date(`${weekStart}T00:00:00Z`).getTime();
  const cur = new Date(`${ymd}T00:00:00Z`).getTime();
  const diff = Math.round((cur - start) / 86400000);
  return diff + 1;
}

async function getConfig(sb: SupabaseClient) {
  const { data, error } = await sb.from("scanv_social_config").select("*").eq("id", "default").maybeSingle();
  if (error) throw new Error(error.message);
  return data || { id: "default", week_start_date: istYmd(), handle: "scanvapp", app_link: "https://scanv-tau.vercel.app" };
}

function withScheduledDates<T extends Record<string, unknown>>(
  items: T[],
  weekStart: string,
): Array<T & { effective_date: string; day_label: string }> {
  return items.map((item) => {
    const dayNum = Number(item.day_number) || 1;
    const effective = String(item.scheduled_date || addDaysYmd(weekStart, dayNum - 1));
    return {
      ...item,
      effective_date: effective,
      day_label: `Day ${dayNum}`,
    };
  });
}

function computeStreak(postedDates: string[]): number {
  const set = new Set(postedDates);
  let streak = 0;
  let cursor = istYmd();
  while (set.has(cursor)) {
    streak += 1;
    cursor = addDaysYmd(cursor, -1);
  }
  return streak;
}

export async function getSocialDashboard(sb: SupabaseClient) {
  const config = await getConfig(sb);
  const weekStart = String(config.week_start_date || istYmd());
  const today = istYmd();

  const { data: rows, error } = await sb
    .from("scanv_social_content")
    .select("*")
    .order("week_number")
    .order("day_number")
    .order("sort_order");
  if (error) throw new Error(error.message);

  const items = withScheduledDates(rows || [], weekStart);
  const todayDay = dayNumberForDate(weekStart, today);
  const inWeek = todayDay >= 1 && todayDay <= 7;

  const todayItems = items.filter((i) => i.effective_date === today && i.post_status !== "skipped");
  const todayPending = todayItems.filter((i) => i.post_status !== "posted");
  const weekItems = items.filter((i) => Number(i.week_number) === 1);
  const weekPosted = weekItems.filter((i) => i.post_status === "posted").length;

  const videos = items.filter((i) => ["video", "reel", "short"].includes(String(i.content_type)));
  const stories = items.filter((i) => i.content_type === "story");
  const emotional = items.filter((i) => i.emotional || i.content_type === "emotional_story");

  const postedDates = [...new Set(
    items
      .filter((i) => i.post_status === "posted" && i.posted_at)
      .map((i) => istYmd(new Date(String(i.posted_at)))),
  )];

  const byDay: Record<number, typeof items> = {};
  for (const item of items) {
    const d = Number(item.day_number);
    if (!byDay[d]) byDay[d] = [];
    byDay[d].push(item);
  }

  return {
    config: {
      handle: config.handle,
      app_link: config.app_link,
      week_start_date: weekStart,
      today,
      today_day_number: inWeek ? todayDay : null,
    },
    summary: {
      due_today: todayPending.length,
      total_today: todayItems.length,
      posted_today: todayItems.filter((i) => i.post_status === "posted").length,
      week_total: weekItems.length,
      week_posted: weekPosted,
      week_pending: weekItems.filter((i) => i.post_status !== "posted" && i.post_status !== "skipped").length,
      streak_days: computeStreak(postedDates),
      videos_pending: videos.filter((i) => i.post_status !== "posted" && i.post_status !== "skipped").length,
      stories_pending: stories.filter((i) => i.post_status !== "posted" && i.post_status !== "skipped").length,
      emotional_pending: emotional.filter((i) => i.post_status !== "posted" && i.post_status !== "skipped").length,
    },
    today_queue: todayItems,
    items,
    by_day: byDay,
    videos,
    stories,
    emotional_stories: emotional,
  };
}

export async function updateSocialContent(sb: SupabaseClient, body: Record<string, unknown>) {
  const id = String(body.id || "").trim();
  if (!id) return { error: "id required" };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const fields = [
    "post_status", "post_url", "notes", "caption", "format_notes",
    "scheduled_date", "scheduled_at", "posted_at", "platform", "content_type", "title",
  ] as const;

  for (const key of fields) {
    if (body[key] !== undefined) patch[key] = body[key];
  }

  if (body.mark_posted) {
    patch.post_status = "posted";
    patch.posted_at = body.posted_at || new Date().toISOString();
  }

  const { data, error } = await sb
    .from("scanv_social_content")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) return { error: error.message };
  return { item: data };
}

export async function addSocialContent(sb: SupabaseClient, body: Record<string, unknown>) {
  const title = String(body.title || "").trim();
  if (!title) return { error: "title required" };

  const id = String(body.id || `custom-${Date.now()}`);
  const row = {
    id,
    week_number: Number(body.week_number) || 1,
    day_number: Math.min(Math.max(Number(body.day_number) || 1, 1), 7),
    title,
    content_type: String(body.content_type || "post"),
    platform: String(body.platform || "all"),
    caption: body.caption ? String(body.caption) : null,
    format_notes: body.format_notes ? String(body.format_notes) : null,
    emotional: Boolean(body.emotional),
    post_status: "planned",
    sort_order: Number(body.sort_order) || 60,
  };

  const { data, error } = await sb.from("scanv_social_content").insert(row).select("*").single();
  if (error) return { error: error.message };
  return { item: data };
}

export async function updateSocialConfig(sb: SupabaseClient, body: Record<string, unknown>) {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.week_start_date !== undefined) patch.week_start_date = body.week_start_date;
  if (body.handle !== undefined) patch.handle = body.handle;
  if (body.app_link !== undefined) patch.app_link = body.app_link;

  const { data, error } = await sb
    .from("scanv_social_config")
    .update(patch)
    .eq("id", "default")
    .select("*")
    .single();
  if (error) return { error: error.message };
  return { config: data };
}
