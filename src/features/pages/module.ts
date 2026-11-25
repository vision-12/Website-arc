import 'server-only';
import { ActionFailure } from '@/lib/actions/errors';
import { CacheTags } from '@/lib/cache/tags';
import { TiptapDoc } from '@/lib/rich-text/schema';
import { warmAddresses } from '@/lib/cache/warm';
import { asJson } from '@/lib/supabase/json';
import { contentService } from '@/features/content/service';
import { nextSlug } from '@/features/content/slug';
import { EMPTY_DOC, PageDraftValues, PageSeo, type PageValues } from './schema';
import { pagesTable, type PagePatch, type PageRow } from './table';

export const ADDRESS_TAKEN = 'Another page already uses this address. Choose a different one.';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23505'
  );
}

/** Drops empty SEO fields so the stored JSON stays small and "not set" means not set. */
function cleanSeo(seo: PageSeo): PageSeo {
  return {
    ...(seo.title ? { title: seo.title } : {}),
    ...(seo.description ? { description: seo.description } : {}),
    ...(seo.noindex ? { noindex: true } : {}),
    ...(seo.ogImageMediaId ? { ogImageMediaId: seo.ogImageMediaId } : {}),
  };
}

export function pageValuesFromRow(row: PageRow): PageValues {
  const body = TiptapDoc.safeParse(row.body);
  const seo = PageSeo.safeParse(row.seo);
  return {
    title: row.title,
    slug: row.slug,
    parentId: row.parent_id,
    body: body.success ? body.data : EMPTY_DOC,
    excerpt: row.excerpt ?? '',
    layout: row.layout,
    showInNav: row.show_in_nav,
    coverMediaId: row.cover_media_id,
    seo: seo.success ? seo.data : {},
  };
}

export const pagesContent = contentService<PageValues, PageRow, PagePatch>({
  module: 'pages',
  table: pagesTable,
  draftValues: PageDraftValues,
  toPatch: (v) => ({
    title: v.title,
    slug: v.slug,
    parent_id: v.parentId,
    body: asJson(v.body),
    excerpt: v.excerpt === '' ? null : v.excerpt,
    layout: v.layout,
    show_in_nav: v.showInNav,
    cover_media_id: v.coverMediaId,
    seo: asJson(cleanSeo(v.seo)),
  }),
  fromRow: pageValuesFromRow,
  titleOf: (row) => row.title,
  auditView: (row) => ({
    title: row.title,
    path: row.path,
    status: row.status,
    publish_at: row.publish_at,
    layout: row.layout,
    show_in_nav: row.show_in_nav,
    parent_id: row.parent_id,
    cover_media_id: row.cover_media_id,
  }),
  // Every public page loader is tagged `pages` (menus and side menus list other pages).
  publicTags: (row) => [CacheTags.pages, CacheTags.page(row.path), CacheTags.redirects],
  writeError: (error) =>
    isUniqueViolation(error)
      ? new ActionFailure('VALIDATION', ADDRESS_TAKEN, { slug: [ADDRESS_TAKEN] })
      : null,
  renameOnRestore: (row) => ({ slug: nextSlug(row.slug) }),
  afterWrite: (before, after) => {
    if (before.published_at && before.path !== after.path) warmAddresses([before.path]);
  },
});
