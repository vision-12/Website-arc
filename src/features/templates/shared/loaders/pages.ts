import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { CacheTags } from '@/lib/cache/tags';
import { createPublicClient } from '@/lib/supabase/server';

/**
 * Paths of published CMS pages, by id. RLS returns only what visitors may see, so links to draft,
 * scheduled or deleted pages resolve to nothing and are left out of menus.
 */
export async function getPagePaths(ids: readonly string[]): Promise<Record<string, string>> {
  'use cache';
  cacheLife('hours');
  cacheTag(CacheTags.pages);
  const unique = [...new Set(ids)].sort();
  if (unique.length === 0) return {};

  const { data, error } = await createPublicClient()
    .from('pages')
    .select('id, path')
    .in('id', unique);
  if (error) return {};
  return Object.fromEntries(data.map((row) => [row.id, row.path]));
}
