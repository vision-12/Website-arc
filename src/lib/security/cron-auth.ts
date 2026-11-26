import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { serverEnv } from '@/lib/env/server';

/**
 * `Authorization: Bearer <CRON_SECRET>`, compared in constant time. Used by the cron routes (sent by
 * Vercel Schedules path targets, plan P4-I) and the internal job webhook (spec D13).
 */
export function hasCronSecret(request: Request): boolean {
  const header = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${serverEnv().CRON_SECRET}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
