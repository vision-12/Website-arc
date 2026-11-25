import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { CacheTags } from '@/lib/cache/tags';
import { publicEnv } from '@/lib/env/public';
import { createPublicClient } from '@/lib/supabase/server';
import type { ImageRef } from '../../types';

/** Public URL of an object in a public bucket (the `media` bucket is read by URL, never listed). */
export function publicObjectUrl(bucket: string, path: string): string {
  return `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

/**
 * Resolves media ids to presentation-ready images. Unknown, deleted or non-image ids are simply
 * absent from the result, so a section can drop the slide or card instead of breaking.
 */
export async function getImageRefs(ids: readonly string[]): Promise<Record<string, ImageRef>> {
  'use cache';
  cacheLife('hours');
  const unique = [...new Set(ids)].sort();
  for (const id of unique) cacheTag(CacheTags.media(id));
  if (unique.length === 0) return {};

  const { data, error } = await createPublicClient()
    .from('media_assets')
    .select('id, kind, bucket, path, width, height, alt_text, lqip')
    .in('id', unique)
    .is('deleted_at', null);
  if (error) return {};

  const refs: Record<string, ImageRef> = {};
  for (const row of data) {
    if (row.kind !== 'image' || !row.width || !row.height) continue;
    refs[row.id] = {
      src: publicObjectUrl(row.bucket, row.path),
      width: row.width,
      height: row.height,
      alt: row.alt_text ?? '',
      ...(row.lqip ? { lqip: row.lqip } : {}),
    };
  }
  return refs;
}
