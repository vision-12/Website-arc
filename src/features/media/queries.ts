import 'server-only';
import { publicObjectUrl } from '@/lib/storage/public-url';
import { createClient, type TypedClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import {
  MediaListInput,
  PAGE_SIZE,
  type MediaItem,
  type MediaPage,
  type MediaUsage,
} from './schema';

/** Media library reads for the admin (user-scoped client: RLS applies, media.view sees all). */

export const MEDIA_COLUMNS =
  'id, kind, bucket, path, original_filename, mime_type, size_bytes, width, height, alt_text, caption, lqip, created_at, version, deleted_at' as const;

type Row = Database['public']['Tables']['media_assets']['Row'];
export type MediaRow = Pick<
  Row,
  | 'id'
  | 'kind'
  | 'bucket'
  | 'path'
  | 'original_filename'
  | 'mime_type'
  | 'size_bytes'
  | 'width'
  | 'height'
  | 'alt_text'
  | 'caption'
  | 'lqip'
  | 'created_at'
  | 'version'
  | 'deleted_at'
>;

export function toMediaItem(row: MediaRow): MediaItem {
  return {
    id: row.id,
    kind: row.kind,
    url: publicObjectUrl(row.bucket, row.path),
    filename: row.original_filename ?? (row.kind === 'image' ? 'Photo' : 'Document'),
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    width: row.width,
    height: row.height,
    altText: row.alt_text ?? '',
    caption: row.caption ?? '',
    lqip: row.lqip,
    createdAt: row.created_at,
    version: row.version,
    deletedAt: row.deleted_at,
  };
}

/** PostgREST filter values: drop characters with meaning in its syntax. */
const searchTerm = (q: string) =>
  q
    .replace(/[%_,()*\\:."'`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export async function listMedia(raw: MediaListInput): Promise<MediaPage> {
  const input = MediaListInput.parse(raw);
  const supabase = await createClient();
  let query = supabase
    .from('media_assets')
    .select(MEDIA_COLUMNS, { count: 'exact' })
    .not('confirmed_at', 'is', null)
    .is('deleted_at', null);
  if (input.kind) query = query.eq('kind', input.kind);
  if (input.missingAlt) query = query.eq('kind', 'image').is('alt_text', null);
  const term = input.q ? searchTerm(input.q) : '';
  if (term) query = query.or(`original_filename.ilike."*${term}*",alt_text.ilike."*${term}*"`);
  const from = (input.page - 1) * PAGE_SIZE;
  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (error) throw error;
  return { items: data.map(toMediaItem), total: count ?? 0, page: input.page, pageSize: PAGE_SIZE };
}

/** Library items by id (any state), for the editor and the picker. */
export async function getMediaByIds(ids: readonly string[]): Promise<Record<string, MediaItem>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('media_assets')
    .select(MEDIA_COLUMNS)
    .in('id', unique)
    .not('confirmed_at', 'is', null);
  if (error) throw error;
  return Object.fromEntries(data.map((row) => [row.id, toMediaItem(row)]));
}

const FIELD_LABEL: Record<string, string> = {
  body: 'in the page text',
  cover: 'as the cover photo',
  'seo.ogImage': 'as the picture for Google and social media',
};

/** "Used in" (MP §5.9): which pages use the item, with links to their editors. */
export async function getMediaUsages(supabase: TypedClient, id: string): Promise<MediaUsage[]> {
  const { data: usages, error } = await supabase
    .from('media_usages')
    .select('entity_type, entity_id, field')
    .eq('media_id', id);
  if (error) throw error;
  const pageIds = usages.filter((u) => u.entity_type === 'pages').map((u) => u.entity_id);
  const { data: pages } = pageIds.length
    ? await supabase.from('pages').select('id, title').in('id', pageIds)
    : { data: [] as { id: string; title: string }[] };
  const titles = new Map((pages ?? []).map((p) => [p.id, p.title]));
  return usages.map((u) => ({
    label: titles.get(u.entity_id) ?? 'A page you can’t open',
    href: `/admin/pages/${u.entity_id}`,
    where: FIELD_LABEL[u.field] ?? 'on the website',
  }));
}

export async function listTrashedMedia(): Promise<MediaItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('media_assets')
    .select(MEDIA_COLUMNS)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return data.map(toMediaItem);
}
