/** ScanV social content calendar + daily posting dashboard (admin-hub). */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const IST = "Asia/Kolkata";

export const EVERYWHERE_PLATFORMS = [
  { id: "facebook", label: "Facebook", studio: "https://business.facebook.com/" },
  { id: "instagram", label: "Instagram", studio: "https://business.facebook.com/" },
  { id: "tiktok", label: "TikTok", studio: "https://www.tiktok.com/upload" },
  { id: "youtube", label: "YouTube", studio: "https://studio.youtube.com/" },
  { id: "youtube_shorts", label: "YouTube Shorts", studio: "https://studio.youtube.com/" },
] as const;

export type PlatformId = typeof EVERYWHERE_PLATFORMS[number]["id"];

type PlatformEntry = { posted?: boolean; url?: string; posted_at?: string };
type PlatformStatus = Partial<Record<PlatformId, PlatformEntry>>;

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
  return Math.round((cur - start) / 86400000) + 1;
}

function calendarDayFromOffset(offset: number): number {
  return ((offset - 1) % 7) + 1;
}

function calendarWeekFromOffset(offset: number): number {
  return Math.floor((offset - 1) / 7) + 1;
}

async function getConfig(sb: SupabaseClient) {
  const { data, error } = await sb.from("scanv_social_config").select("*").eq("id", "default").maybeSingle();
  if (error) throw new Error(error.message);
  return data || { id: "default", week_start_date: istYmd(), handle: "scanvapp", app_link: "https://scanv-tau.vercel.app" };
}

function parsePlatformStatus(raw: unknown): PlatformStatus {
  if (!raw || typeof raw !== "object") return {};
  return raw as PlatformStatus;
}

export function platformProgress(status: PlatformStatus) {
  const total = EVERYWHERE_PLATFORMS.length;
  const posted = EVERYWHERE_PLATFORMS.filter((p) => status[p.id]?.posted).length;
  return { posted, total, complete: posted >= total };
}

function enrichItem<T extends Record<string, unknown>>(item: T, today: string, dayOffset: number) {
  const calendarDay = calendarDayFromOffset(dayOffset);
  const calendarWeek = calendarWeekFromOffset(dayOffset);
  const platform_status = parsePlatformStatus(item.platform_status);
  const progress = platformProgress(platform_status);
  return {
    ...item,
    effective_date: today,
    day_label: `Day ${calendarDay} (week ${calendarWeek})`,
    calendar_day: calendarDay,
    calendar_week: calendarWeek,
    platform_status,
    everywhere_progress: progress,
  };
}

function matchesToday(item: Record<string, unknown>, calendarDay: number): boolean {
  return Number(item.day_number) === calendarDay && Number(item.week_number) === 1;
}

function computeStreak(
  items: Array<Record<string, unknown>>,
  weekStart: string,
  today: string,
): number {
  const bundles = items.filter((i) => i.is_daily_everywhere && i.content_type !== "reel" && i.content_type !== "short" && i.content_type !== "video");
  const dayOffset = dayNumberForDate(weekStart, today);
  let streak = 0;

  for (let offset = dayOffset; offset >= 1; offset--) {
    const calDay = calendarDayFromOffset(offset);
    const date = addDaysYmd(weekStart, offset - 1);
    const bundle = bundles.find((b) => Number(b.day_number) === calDay);
    if (!bundle) break;
    const ps = parsePlatformStatus(bundle.platform_status);
    const { complete } = platformProgress(ps);
    const postedLegacy = bundle.post_status === "posted";
    if (complete || postedLegacy) streak += 1;
    else break;
  }
  return streak;
}

export async function getSocialDashboard(sb: SupabaseClient) {
  const config = await getConfig(sb);
  const weekStart = String(config.week_start_date || istYmd());
  const today = istYmd();
  const dayOffset = dayNumberForDate(weekStart, today);
  const calendarDay = dayOffset >= 1 ? calendarDayFromOffset(dayOffset) : null;
  const calendarWeek = dayOffset >= 1 ? calendarWeekFromOffset(dayOffset) : null;

  const { data: rows, error } = await sb
    .from("scanv_social_content")
    .select("*")
    .order("week_number")
    .order("day_number")
    .order("sort_order");
  if (error) throw new Error(error.message);

  const allItems = rows || [];
  const todayRaw = calendarDay
    ? allItems.filter((i) => matchesToday(i, calendarDay) && i.post_status !== "skipped")
    : [];

  const todayItems = todayRaw.map((i) => enrichItem(i, today, dayOffset));
  const todayPending = todayItems.filter((i) => i.post_status !== "posted" && !i.everywhere_progress?.complete);

  const everywhereBundles = todayItems.filter((i) => i.is_daily_everywhere);
  const primaryEverywhere = everywhereBundles.find((i) =>
    ["post", "carousel"].includes(String(i.content_type))
  ) || everywhereBundles[0] || null;

  const videoEverywhere = everywhereBundles.find((i) =>
    ["reel", "short", "video"].includes(String(i.content_type))
  ) || null;

  const weekItems = allItems.filter((i) => Number(i.week_number) === 1);
  const videos = allItems.filter((i) => ["video", "reel", "short"].includes(String(i.content_type)));
  const stories = allItems.filter((i) => i.content_type === "story");
  const emotional = allItems.filter((i) => i.emotional || i.content_type === "emotional_story");

  const primaryProgress = primaryEverywhere
    ? platformProgress(parsePlatformStatus(primaryEverywhere.platform_status))
    : { posted: 0, total: EVERYWHERE_PLATFORMS.length, complete: false };

  const byDay: Record<number, typeof todayItems> = {};
  for (let d = 1; d <= 7; d++) {
    byDay[d] = allItems
      .filter((i) => Number(i.day_number) === d && Number(i.week_number) === 1)
      .map((i) => enrichItem(i, addDaysYmd(weekStart, d - 1), d));
  }

  return {
    config: {
      handle: config.handle,
      app_link: config.app_link,
      week_start_date: weekStart,
      today,
      today_day_number: calendarDay,
      calendar_week: calendarWeek,
      day_offset: dayOffset,
    },
    everywhere_platforms: EVERYWHERE_PLATFORMS,
    today_everywhere: primaryEverywhere,
    today_video_everywhere: videoEverywhere,
    everywhere_progress: primaryProgress,
    summary: {
      due_today: todayPending.length,
      total_today: todayItems.length,
      posted_today: todayItems.filter((i) => i.post_status === "posted" || i.everywhere_progress?.complete).length,
      everywhere_posted: primaryProgress.posted,
      everywhere_total: primaryProgress.total,
      everywhere_complete: primaryProgress.complete,
      week_total: weekItems.length,
      week_posted: weekItems.filter((i) => i.post_status === "posted").length,
      streak_days: computeStreak(allItems, weekStart, today),
      videos_pending: videos.filter((i) => i.post_status !== "posted" && i.post_status !== "skipped").length,
      stories_pending: stories.filter((i) => i.post_status !== "posted" && i.post_status !== "skipped").length,
      emotional_pending: emotional.filter((i) => i.post_status !== "posted" && i.post_status !== "skipped").length,
    },
    today_queue: todayItems,
    items: allItems.map((i) => enrichItem(i, today, dayOffset)),
    by_day: byDay,
    videos,
    stories,
    emotional_stories: emotional,
  };
}

async function savePlatformPatch(
  sb: SupabaseClient,
  id: string,
  platformStatus: PlatformStatus,
  markItemPosted: boolean,
) {
  const patch: Record<string, unknown> = {
    platform_status: platformStatus,
    updated_at: new Date().toISOString(),
  };
  if (markItemPosted) {
    patch.post_status = "posted";
    patch.posted_at = new Date().toISOString();
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

export async function updateSocialPlatform(
  sb: SupabaseClient,
  body: Record<string, unknown>,
) {
  const id = String(body.id || "").trim();
  const platform = String(body.platform || "").trim() as PlatformId;
  if (!id || !platform) return { error: "id and platform required" };
  if (!EVERYWHERE_PLATFORMS.some((p) => p.id === platform)) return { error: "invalid platform" };

  const { data: row, error: loadErr } = await sb
    .from("scanv_social_content")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (loadErr) return { error: loadErr.message };
  if (!row) return { error: "not found" };

  const status = parsePlatformStatus(row.platform_status);
  if (body.posted === false) {
    delete status[platform];
  } else {
    status[platform] = {
      posted: true,
      url: body.url ? String(body.url) : status[platform]?.url,
      posted_at: body.posted_at ? String(body.posted_at) : new Date().toISOString(),
    };
  }

  const { complete } = platformProgress(status);
  return savePlatformPatch(sb, id, status, complete || Boolean(body.mark_item_posted));
}

export async function markSocialEverywhere(
  sb: SupabaseClient,
  body: Record<string, unknown>,
) {
  const id = String(body.id || "").trim();
  if (!id) return { error: "id required" };

  const now = new Date().toISOString();
  const status: PlatformStatus = {};
  const urls = (body.urls && typeof body.urls === "object") ? body.urls as Record<string, string> : {};

  for (const p of EVERYWHERE_PLATFORMS) {
    status[p.id] = {
      posted: true,
      url: urls[p.id] || undefined,
      posted_at: now,
    };
  }

  return savePlatformPatch(sb, id, status, true);
}

export async function updateSocialContent(sb: SupabaseClient, body: Record<string, unknown>) {
  const id = String(body.id || "").trim();
  if (!id) return { error: "id required" };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const fields = [
    "post_status", "post_url", "notes", "caption", "format_notes",
    "scheduled_date", "scheduled_at", "posted_at", "platform", "content_type", "title",
    "platform_status",
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
    is_daily_everywhere: Boolean(body.is_daily_everywhere),
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
