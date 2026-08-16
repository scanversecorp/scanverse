/** Booking schedule helpers — IST windows, min lead, next available slot. */

const IST = 'Asia/Kolkata';

export const DEFAULT_SCHEDULE = {
  min_lead_minutes: 30,
  slot_minutes: 30,
  enforce_schedule: true,
  allow_outside_schedule: false,
  windows: [
    { day: 1, start: '09:00', end: '19:00' },
    { day: 2, start: '09:00', end: '19:00' },
    { day: 3, start: '09:00', end: '19:00' },
    { day: 4, start: '09:00', end: '19:00' },
    { day: 5, start: '09:00', end: '19:00' },
    { day: 6, start: '09:00', end: '19:00' },
  ],
};

export function normalizeScheduleRow(row) {
  if (!row) return { ...DEFAULT_SCHEDULE, service_id: null };
  const windows = Array.isArray(row.windows) && row.windows.length ? row.windows : DEFAULT_SCHEDULE.windows;
  return {
    service_id: row.service_id || null,
    parent_id: row.parent_id || null,
    min_lead_minutes: row.min_lead_minutes ?? DEFAULT_SCHEDULE.min_lead_minutes,
    slot_minutes: row.slot_minutes ?? DEFAULT_SCHEDULE.slot_minutes,
    enforce_schedule: row.enforce_schedule !== false,
    allow_outside_schedule: !!row.allow_outside_schedule,
    windows,
    notes: row.notes || '',
  };
}

function istParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const p = Object.fromEntries(fmt.formatToParts(date).filter((x) => x.type !== 'literal').map((x) => [x.type, x.value]));
  const wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.weekday] ?? 0;
  return {
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    h: Number(p.hour),
    min: Number(p.minute),
    day: wd,
    dateStr: `${p.year}-${p.month}-${p.day}`,
  };
}

function parseHm(hm) {
  const [h, m] = String(hm || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function hmFromMinutes(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function windowsForDay(schedule, day) {
  return (schedule.windows || []).filter((w) => Number(w.day) === day);
}

function slotInWindow(slotMin, windows) {
  return windows.some((w) => {
    const start = parseHm(w.start);
    const end = parseHm(w.end);
    return slotMin >= start && slotMin < end;
  });
}

export function earliestBookableMinutes(schedule, now = new Date()) {
  const lead = schedule.min_lead_minutes ?? 30;
  const slot = schedule.slot_minutes ?? 30;
  const p = istParts(now);
  let cursor = p.h * 60 + p.min + lead;
  cursor = Math.ceil(cursor / slot) * slot;
  return { dateStr: p.dateStr, minutes: cursor, day: p.day };
}

export function isSlotInPast(dateStr, timeStr, schedule, now = new Date()) {
  const lead = schedule.min_lead_minutes ?? 30;
  const nowP = istParts(now);
  const pickedMin = parseHm(timeStr);
  const earliestMin = nowP.h * 60 + nowP.min + lead;
  if (dateStr < nowP.dateStr) return true;
  if (dateStr > nowP.dateStr) return false;
  return pickedMin < earliestMin;
}

export function isSlotInSchedule(dateStr, timeStr, schedule) {
  if (!schedule.enforce_schedule) return true;
  const [y, m, d] = dateStr.split('-').map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d, 12, 0));
  const day = istParts(probe).day;
  const slotMin = parseHm(timeStr);
  return slotInWindow(slotMin, windowsForDay(schedule, day));
}

export function findNextAvailableSlot(schedule, from = new Date(), maxDays = 14) {
  const slot = schedule.slot_minutes ?? 30;
  let probe = earliestBookableMinutes(schedule, from);
  for (let i = 0; i < maxDays * (24 * 60 / slot); i++) {
    const wins = windowsForDay(schedule, probe.day);
    if (wins.length && slotInWindow(probe.minutes, wins)) {
      return { date: probe.dateStr, time: hmFromMinutes(probe.minutes) };
    }
    probe.minutes += slot;
    const endOfDay = 24 * 60;
    if (probe.minutes >= endOfDay) {
      const [y, m, d] = probe.dateStr.split('-').map(Number);
      const next = new Date(Date.UTC(y, m - 1, d + 1, 6, 0));
      const np = istParts(next);
      probe = { dateStr: np.dateStr, minutes: parseHm('09:00'), day: np.day };
    }
  }
  return null;
}

export function validateBookingSlot(dateStr, timeStr, schedule, { outsideOk = false } = {}) {
  if (!dateStr || !timeStr) return { ok: false, code: 'missing', message: 'Select date and time' };
  const sched = normalizeScheduleRow(schedule);
  if (isSlotInPast(dateStr, timeStr, sched)) {
    const next = findNextAvailableSlot(sched);
    return {
      ok: false,
      code: 'past',
      message: `Earliest booking is ${sched.min_lead_minutes} minutes from now`,
      next,
    };
  }
  if (sched.enforce_schedule && !isSlotInSchedule(dateStr, timeStr, sched)) {
    const next = findNextAvailableSlot(sched);
    if (outsideOk && sched.allow_outside_schedule) {
      return { ok: true, outsideSchedule: true, next };
    }
    return {
      ok: false,
      code: 'outside',
      message: 'This time is outside service hours',
      next,
      canOverride: sched.allow_outside_schedule,
    };
  }
  return { ok: true };
}

export function formatSlotLabel(dateStr, timeStr) {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const day = dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    return `${day} · ${timeStr}`;
  } catch {
    return `${dateStr} ${timeStr}`;
  }
}

export async function fetchServiceSchedule(sb, serviceId) {
  if (!serviceId || !sb) return normalizeScheduleRow(null);
  const { data, error } = await sb().from('service_schedules').select('*').eq('service_id', serviceId).maybeSingle();
  if (error) throw error;
  return normalizeScheduleRow(data);
}

export async function fetchScheduleMap(sb, serviceIds) {
  const ids = [...new Set((serviceIds || []).filter(Boolean))];
  if (!ids.length) return {};
  const { data, error } = await sb().from('service_schedules').select('*').in('service_id', ids);
  if (error) throw error;
  const map = {};
  for (const row of data || []) map[row.service_id] = normalizeScheduleRow(row);
  return map;
}
