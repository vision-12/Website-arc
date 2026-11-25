import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { CacheTags } from '@/lib/cache/tags';
import { createPublicClient } from '@/lib/supabase/server';
import type { IntakeCard } from '../../types';

/**
 * The intake currently taking applications, if any. Cached for minutes, not hours, because
 * opening and closing happen at set times rather than on publish.
 */
export async function getOpenIntake(): Promise<IntakeCard | null> {
  'use cache';
  cacheLife('minutes');
  cacheTag(CacheTags.admissionsPublic);
  const now = new Date().toISOString();
  const { data, error } = await createPublicClient()
    .from('admission_intakes')
    .select('name, slug, closes_at')
    .lte('opens_at', now)
    .gt('closes_at', now)
    .order('closes_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return { name: data.name, href: `/admissions/apply/${data.slug}`, closesAt: data.closes_at };
}
