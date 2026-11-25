import type { SectionLocale } from '../types';

const DATE_STYLES: Record<string, Intl.DateTimeFormatOptions> = {
  'd MMM yyyy': { day: 'numeric', month: 'short', year: 'numeric' },
  'd MMMM yyyy': { day: 'numeric', month: 'long', year: 'numeric' },
  'dd/MM/yyyy': { day: '2-digit', month: '2-digit', year: 'numeric' },
  'EEE d MMM yyyy': { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' },
};

/** Dates are stored in UTC and always shown in the school's timezone (CLAUDE.md). */
export function formatDate(iso: string, locale: SectionLocale): string {
  const style = DATE_STYLES[locale.dateFormat] ?? DATE_STYLES['d MMM yyyy'];
  return new Intl.DateTimeFormat('en-GB', { ...style, timeZone: locale.timezone }).format(
    new Date(iso),
  );
}

export function formatTime(iso: string, locale: SectionLocale): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: locale.timezone,
  }).format(new Date(iso));
}

/** Day, short month and weekday for calendar-style date badges. */
export function dateParts(
  iso: string,
  locale: SectionLocale,
): { day: string; month: string; weekday: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
    timeZone: locale.timezone,
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return { day: get('day'), month: get('month'), weekday: get('weekday') };
}
