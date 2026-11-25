import 'server-only';
import type { ContentTableAdapter } from '@/features/content/service';
import type { TypedClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

/** Typed queries on `pages` for the shared content service. */

export const PAGE_COLUMNS =
  'id, parent_id, title, slug, path, body, excerpt, layout, show_in_nav, nav_order, system_key, seo, cover_media_id, status, publish_at, published_at, created_at, updated_at, updated_by, deleted_at, version' as const;

type Table = Database['public']['Tables']['pages'];
export type PageRow = Pick<
  Table['Row'],
  | 'id'
  | 'parent_id'
  | 'title'
  | 'slug'
  | 'path'
  | 'body'
  | 'excerpt'
  | 'layout'
  | 'show_in_nav'
  | 'nav_order'
  | 'system_key'
  | 'seo'
  | 'cover_media_id'
  | 'status'
  | 'publish_at'
  | 'published_at'
  | 'created_at'
  | 'updated_at'
  | 'updated_by'
  | 'deleted_at'
  | 'version'
>;
export type PagePatch = Pick<
  Table['Update'],
  | 'title'
  | 'slug'
  | 'parent_id'
  | 'body'
  | 'excerpt'
  | 'layout'
  | 'show_in_nav'
  | 'nav_order'
  | 'cover_media_id'
  | 'seo'
>;

export const pagesTable: ContentTableAdapter<PageRow, PagePatch> = {
  async get(supabase: TypedClient, id: string) {
    const { data, error } = await supabase
      .from('pages')
      .select(PAGE_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  async update(supabase, id, version, patch) {
    const { data, error } = await supabase
      .from('pages')
      .update(patch)
      .eq('id', id)
      .eq('version', version)
      .is('deleted_at', null)
      .select(PAGE_COLUMNS)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  async restore(supabase, id, patch) {
    const { data, error } = await supabase
      .from('pages')
      .update(patch)
      .eq('id', id)
      .not('deleted_at', 'is', null)
      .select(PAGE_COLUMNS)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  async remove(supabase, id) {
    const { error } = await supabase
      .from('pages')
      .delete()
      .eq('id', id)
      .not('deleted_at', 'is', null);
    if (error) throw error;
  },
};
