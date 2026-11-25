import { z } from 'zod';
import { TiptapDoc } from '@/lib/rich-text/schema';
import { PublishAt, SendBackNote, Version } from '@/features/content/schema';
import { SLUG_MAX, SLUG_RE } from '@/features/content/slug';

/** CMS pages (MP §5.9, spec §1.4). Shared by the editor (browser checks) and the actions. */

export const PAGE_LAYOUTS = ['default', 'wide', 'with_sidebar'] as const;
export type PageLayout = (typeof PAGE_LAYOUTS)[number];

/** Top-level addresses kept for built-in sections. Mirrors private.page_path_maintain(). */
export const RESERVED_ROOT_SLUGS: ReadonlySet<string> = new Set([
  'search',
  'admin',
  'api',
  'preview',
  'login',
  'news',
  'events',
  'gallery',
  'staff',
  'resources',
  'contact',
  'admissions',
  'academics',
  'legal',
  'about',
  'theme-css',
  'mfa',
]);

export const MAX_PAGE_DEPTH = 3;

const title = z
  .string()
  .trim()
  .min(2, 'Give the page a title of at least 2 characters.')
  .max(150, 'Keep the title under 150 characters.');

const slug = z
  .string()
  .trim()
  .max(SLUG_MAX, `Keep the address under ${SLUG_MAX} characters.`)
  .regex(SLUG_RE, 'Use lower-case letters, numbers and hyphens, for example "school-fees".');

export const PageSeo = z.object({
  title: z.string().trim().max(70, 'Keep the Google title under 70 characters.').optional(),
  description: z
    .string()
    .trim()
    .max(160, 'Keep the Google description under 160 characters.')
    .optional(),
  noindex: z.boolean().optional(),
  ogImageMediaId: z.uuid().nullable().optional(),
});
export type PageSeo = z.infer<typeof PageSeo>;

/** What "Save draft" and "Publish to website" accept. */
export const PageValues = z.object({
  title,
  slug,
  parentId: z.uuid().nullable(),
  body: TiptapDoc,
  excerpt: z.string().trim().max(300, 'Keep the summary under 300 characters.'),
  layout: z.enum(PAGE_LAYOUTS),
  showInNav: z.boolean(),
  coverMediaId: z.uuid().nullable(),
  seo: PageSeo,
});
export type PageValues = z.infer<typeof PageValues>;

/** Work in progress, as autosaved: only bounds, so a half-typed title still saves (D4). */
export const PageDraftValues = z
  .object({
    title: z.string().max(150),
    slug: z.string().max(SLUG_MAX),
    parentId: z.uuid().nullable(),
    body: TiptapDoc,
    excerpt: z.string().max(300),
    layout: z.enum(PAGE_LAYOUTS),
    showInNav: z.boolean(),
    coverMediaId: z.uuid().nullable(),
    seo: z.object({
      title: z.string().max(70).optional(),
      description: z.string().max(160).optional(),
      noindex: z.boolean().optional(),
      ogImageMediaId: z.uuid().nullable().optional(),
    }),
  })
  .partial();
export type PageDraftValues = z.infer<typeof PageDraftValues>;

export const CreatePageInput = z.object({ title, parentId: z.uuid().nullable() });

export const AutosavePageInput = z.object({
  id: z.uuid(),
  baseVersion: Version,
  data: PageDraftValues,
  /** Preview: save now, even within 5 seconds of the last save. */
  force: z.boolean().optional(),
});

export const SavePageInput = z.object({ id: z.uuid(), version: Version, values: PageValues });

export const SchedulePageInput = SavePageInput.extend({ publishAt: PublishAt });

export const SendPageBackInput = z.object({ id: z.uuid(), version: Version, note: SendBackNote });

export const MovePageInput = z.object({
  id: z.uuid(),
  version: Version,
  parentId: z.uuid().nullable(),
});

export const ReorderPagesInput = z.object({
  parentId: z.uuid().nullable(),
  ids: z.array(z.uuid()).min(1).max(500),
});

export const EMPTY_DOC = { type: 'doc' as const, content: [] };
