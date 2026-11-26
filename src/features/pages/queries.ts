import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { CacheTags } from '@/lib/cache/tags';
import { richTextMediaIds } from '@/lib/rich-text/media';
import type { RichTextMedia } from '@/lib/rich-text/render';
import { TiptapDoc } from '@/lib/rich-text/schema';
import { publicObjectUrl } from '@/lib/storage/public-url';
import { createClient, createPublicClient, type TypedClient } from '@/lib/supabase/server';
import { PageDraftValues, PageSeo, type PageLayout } from './schema';
import type { PageListItem } from './tree';

export { inTreeOrder, parentOptions, type PageListItem } from './tree';

// ── Admin ────────────────────────────────────────────────────────────────────────────────────────

/** Every page not in Trash, in menu order, with its depth (1 = top level). */
export async function listPages(): Promise<PageListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pages')
    .select(
      'id, parent_id, title, path, status, publish_at, updated_at, nav_order, show_in_nav, system_key, version',
    )
    .is('deleted_at', null)
    .order('nav_order')
    .order('title');
  if (error) throw error;
  return data.map((p) => ({
    id: p.id,
    parentId: p.parent_id,
    title: p.title,
    path: p.path,
    status: p.status,
    publishAt: p.publish_at,
    updatedAt: p.updated_at,
    navOrder: p.nav_order,
    showInNav: p.show_in_nav,
    systemKey: p.system_key,
    version: p.version,
    depth: p.path.split('/').filter(Boolean).length,
  }));
}

// ── Public site ──────────────────────────────────────────────────────────────────────────────────

export interface PublicPage {
  id: string;
  title: string;
  path: string;
  layout: PageLayout;
  body: TiptapDoc;
  excerpt: string | null;
  seo: PageSeo;
  cover: RichTextMedia['images'][string] | null;
  media: RichTextMedia;
  breadcrumbs: Array<{ label: string; href?: string }>;
  /** The section's pages for the side menu: the top-level page and its sub-pages shown in menus. */
  sectionLinks: Array<{ label: string; href: string; current: boolean }>;
}

/**
 * The cookie-less public client (cached reads) and the user's client (preview) expose the same
 * PostgREST `.from()`; their generic parameters differ, so both are typed through this one view.
 */
type DataClient = Pick<TypedClient, 'from'>;
const publicDb = (): DataClient => createPublicClient();

/** Resolves photos and PDFs for rendering; anything missing or deleted is simply left out. */
async function resolveMedia(db: DataClient, ids: string[]): Promise<RichTextMedia> {
  const media: RichTextMedia = { images: {}, documents: {} };
  if (ids.length === 0) return media;
  const { data, error } = await db
    .from('media_assets')
    .select('id, kind, bucket, path, width, height, alt_text, caption, lqip, size_bytes')
    .in('id', [...new Set(ids)])
    .is('deleted_at', null);
  // Missing media is left out by design; a failed lookup would drop every photo, so say so (no data logged).
  if (error) console.error('page media lookup failed', error.code);
  for (const m of data ?? []) {
    const url = publicObjectUrl(m.bucket, m.path);
    if (m.kind === 'image' && m.width && m.height && m.alt_text)
      media.images[m.id] = {
        src: url,
        width: m.width,
        height: m.height,
        alt: m.alt_text,
        ...(m.lqip ? { lqip: m.lqip } : {}),
        ...(m.caption ? { caption: m.caption } : {}),
      };
    else if (m.kind === 'document') media.documents[m.id] = { url, sizeBytes: m.size_bytes };
  }
  return media;
}

interface PageFields {
  id: string;
  title: string;
  path: string;
  layout: PageLayout;
  body: unknown;
  excerpt: string | null;
  seo: unknown;
  cover_media_id: string | null;
}

async function assemble(db: DataClient, page: PageFields, preview: boolean): Promise<PublicPage> {
  const body = TiptapDoc.safeParse(page.body);
  const doc = body.success ? body.data : { type: 'doc' as const, content: [] };
  const ids = richTextMediaIds(doc);
  const segments = page.path.split('/').filter(Boolean);
  const prefixes = segments.map((_, i) => `/${segments.slice(0, i + 1).join('/')}`);
  const sectionRoot = prefixes[0] ?? page.path;

  const [media, ancestors, section] = await Promise.all([
    resolveMedia(db, [
      ...ids.images,
      ...ids.documents,
      ...(page.cover_media_id ? [page.cover_media_id] : []),
    ]),
    db.from('pages').select('title, path').in('path', prefixes).is('deleted_at', null),
    db
      .from('pages')
      .select('id, title, path, parent_id, show_in_nav, nav_order')
      .like('path', `${sectionRoot}%`)
      .is('deleted_at', null)
      .order('nav_order'),
  ]);
  const titles = new Map((ancestors.data ?? []).map((a) => [a.path, a.title]));
  const root = (section.data ?? []).find((p) => p.path === sectionRoot);
  const links = (section.data ?? []).filter(
    (p) =>
      p.path === sectionRoot ||
      (root && p.parent_id === root.id && (p.show_in_nav || p.path === page.path)) ||
      (preview && p.id === page.id),
  );
  const seo = PageSeo.safeParse(page.seo);
  return {
    id: page.id,
    title: page.title,
    path: page.path,
    layout: page.layout,
    body: doc,
    excerpt: page.excerpt,
    seo: seo.success ? seo.data : {},
    cover: page.cover_media_id ? (media.images[page.cover_media_id] ?? null) : null,
    media,
    breadcrumbs: [
      { label: 'Home', href: '/' },
      ...prefixes.map((p) =>
        p === page.path ? { label: page.title } : { label: titles.get(p) ?? p, href: p },
      ),
    ],
    sectionLinks: links.map((p) => ({
      label: p.title,
      href: p.path,
      current: p.path === page.path,
    })),
  };
}

/** A published page by address, for visitors (cached; publish expires `page:<path>` and `pages`). */
export async function getPublishedPage(path: string): Promise<PublicPage | null> {
  'use cache';
  cacheLife('hours');
  cacheTag(CacheTags.pages, CacheTags.page(path));
  const db = publicDb();
  const { data } = await db
    .from('pages')
    .select('id, title, path, layout, body, excerpt, seo, cover_media_id')
    .eq('path', path)
    .maybeSingle();
  if (!data) return null;
  const page = await assemble(db, data, false);
  for (const id of [...Object.keys(page.media.images), ...Object.keys(page.media.documents)])
    cacheTag(CacheTags.media(id));
  return page;
}

/** An old address that now lives elsewhere (slug change, move): looked up only on a miss (P4-H). */
export async function findRedirect(path: string): Promise<string | null> {
  'use cache';
  cacheLife('hours');
  cacheTag(CacheTags.redirects);
  const { data } = await createPublicClient()
    .from('redirects')
    .select('to_path')
    .eq('from_path', path)
    .maybeSingle();
  return data?.to_path ?? null;
}

/** Addresses to prerender at build time (the rest render on first visit). */
export async function getPublishedPagePaths(): Promise<string[]> {
  const { data } = await createPublicClient().from('pages').select('path').limit(500);
  return (data ?? []).map((p) => p.path);
}

/**
 * Draft preview (MP §5 Preview): the page at this address in any status, with the signed-in
 * person's own working copy applied on top. User-scoped (RLS: pages.view); never cached.
 */
export async function getPreviewPage(path: string, userId: string): Promise<PublicPage | null> {
  const db = await createClient();
  const { data } = await db
    .from('pages')
    .select('id, title, path, layout, body, excerpt, seo, cover_media_id')
    .eq('path', path)
    .is('deleted_at', null)
    .maybeSingle();
  if (!data) return null;
  const { data: copy } = await db
    .from('content_drafts')
    .select('data')
    .eq('entity_type', 'pages')
    .eq('entity_id', data.id)
    .eq('updated_by', userId)
    .maybeSingle();
  const draft = PageDraftValues.safeParse(copy?.data);
  const v = draft.success ? draft.data : {};
  return assemble(
    db,
    {
      ...data,
      ...(v.title ? { title: v.title } : {}),
      ...(v.layout ? { layout: v.layout } : {}),
      ...(v.body ? { body: v.body } : {}),
      ...(v.excerpt !== undefined ? { excerpt: v.excerpt || null } : {}),
      ...(v.seo ? { seo: v.seo } : {}),
      ...(v.coverMediaId !== undefined ? { cover_media_id: v.coverMediaId } : {}),
    },
    true,
  );
}
