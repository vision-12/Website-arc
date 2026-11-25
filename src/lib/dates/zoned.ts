/**
 * Dates are stored in UTC and entered and shown in the school's time zone (CLAUDE.md;
 * `site_settings.locale.timezone`, default Africa/Kampala). Pure functions on Intl, client-safe.
 */

export interface ZonedParts {
  /** yyyy-mm-dd */
  date: string;
  /** HH:mm (24-hour) */
  time: string;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function partsIn(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/** The zone's offset from UTC at that instant, in milliseconds (Kampala: +3 h). */
function offsetMs(date: Date, timeZone: string): number {
  const p = partsIn(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * A wall-clock date and time in `timeZone` → the UTC instant. Returns null for malformed input or
 * a time that doesn't exist on that day (a daylight-saving gap, for zones that have one).
 */
export function zonedTimeToUtc(date: string, time: string, timeZone: string): Date | null {
  const d = DATE_RE.exec(date);
  const t = TIME_RE.exec(time);
  if (!d || !t) return null;
  const [y, m, day] = [Number(d[1]), Number(d[2]), Number(d[3])];
  const [hh, mm] = [Number(t[1]), Number(t[2])];
  const guess = Date.UTC(y, m - 1, day, hh, mm);
  const check = new Date(guess);
  if (check.getUTCMonth() !== m - 1 || check.getUTCDate() !== day) return null;

  let utc = guess - offsetMs(new Date(guess), timeZone);
  const second = guess - offsetMs(new Date(utc), timeZone);
  if (second !== utc) utc = second;
  const round = utcToZoned(new Date(utc), timeZone);
  return round.date === date && round.time === time ? new Date(utc) : null;
}

/** A UTC instant → wall-clock date and time in `timeZone` (for date/time inputs). */
export function utcToZoned(instant: Date, timeZone: string): ZonedParts {
  const p = partsIn(instant, timeZone);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
    time: `${pad(p.hour)}:${pad(p.minute)}`,
  };
}

/** "Thursday 26 November 2026 at 9:30am" in the school's zone, for confirmations and status lines. */
export function formatDateTimeLong(iso: string, timeZone: string): string {
  const date = new Date(iso);
  // Built from parts: ICU writes "Thursday, 26 November"; UK style has no comma after the weekday.
  const day = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
    .formatToParts(date)
    .filter((p) => p.type !== 'literal')
    .map((p) => p.value)
    .join(' ');
  return `${day} at ${formatTimeShort(date, timeZone)}`;
}

/** "26 Nov 2026, 9:30am" in the school's zone, for lists. */
export function formatDateTimeShort(iso: string, timeZone: string): string {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
  return `${day}, ${formatTimeShort(date, timeZone)}`;
}

function formatTimeShort(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(date)
    .replace(/\s/g, '')
    .toLowerCase();
}
