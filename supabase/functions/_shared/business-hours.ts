/** Vendor outreach only during India daytime (9:30 AM – 7 PM IST). */

const TZ = "Asia/Kolkata";
const START_MINS = 9 * 60 + 30;
const END_MINS = 19 * 60;

function istMinutes(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value || 0);
  return h * 60 + m;
}

export function isOutreachWindowOpen(now = new Date()): boolean {
  const mins = istMinutes(now);
  return mins >= START_MINS && mins < END_MINS;
}

export function outreachHoursLabel(): string {
  return "9:30 AM – 7:00 PM IST";
}

export function outsideHoursError(): string {
  return `Outreach paused until ${outreachHoursLabel()} — vendors are unlikely to respond at night.`;
}
