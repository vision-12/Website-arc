/** Web addresses for content (spec §1.4). Must match the database check on `slug`. Client-safe. */

export const SLUG_MAX = 120;
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * "St Mary's Day & Sports — 2026" → "st-marys-day-and-sports-2026". Accents are removed, apostrophes
 * dropped, "&" becomes "and", everything else becomes single hyphens. Long titles are cut at a word.
 */
export function slugify(input: string, maxLength = SLUG_MAX): string {
  const base = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’‘`]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (base.length <= maxLength) return base;
  const cut = base.slice(0, maxLength);
  const lastBreak = cut.lastIndexOf('-');
  return (lastBreak > maxLength / 2 ? cut.slice(0, lastBreak) : cut).replace(/-+$/, '');
}

/** "fees" → "fees-2", "fees-2" → "fees-3": used when an address is already taken. */
export function nextSlug(slug: string): string {
  const m = /^(.*)-(\d+)$/.exec(slug);
  const stem = m?.[1] ?? slug;
  const n = m ? Number(m[2]) + 1 : 2;
  const suffix = `-${n}`;
  return `${stem.slice(0, SLUG_MAX - suffix.length).replace(/-+$/, '')}${suffix}`;
}
