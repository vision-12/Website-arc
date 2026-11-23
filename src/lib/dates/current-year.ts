import { cacheLife } from 'next/cache';

/** Current year for copyright lines; cached for a day so it can live in prerendered shells. */
export async function currentYear(): Promise<number> {
  'use cache';
  cacheLife('days');
  return Promise.resolve(new Date().getFullYear());
}
