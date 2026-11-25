import { publicEnv } from '@/lib/env/public';

/** Public URL of an object in a public bucket (`media`, `resources`); buckets are read by URL, never listed. */
export function publicObjectUrl(bucket: string, path: string): string {
  return `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}
