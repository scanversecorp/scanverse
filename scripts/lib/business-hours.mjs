/** India business hours for vendor outreach — no 4 AM messages. */
const TZ = 'Asia/Kolkata';
const START_HOUR = 9;
const START_MIN = 30;
const END_HOUR = 19;
const END_MIN = 0;

export function istNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
}

export function isOutreachWindowOpen(now = istNow()) {
  const mins = now.getHours() * 60 + now.getMinutes();
  const start = START_HOUR * 60 + START_MIN;
  const end = END_HOUR * 60 + END_MIN;
  return mins >= start && mins < end;
}

export function outreachWindowLabel() {
  return '9:30 AM – 7:00 PM IST (Mon–Sun)';
}

export function outsideHoursMessage() {
  const t = istNow().toLocaleString('en-IN', {
    timeZone: TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `Outside outreach hours (${outreachWindowLabel()}). Now: ${t}. Queue for daytime — vendors are asleep.`;
}
