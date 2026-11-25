import { z } from 'zod';
import {
  type HOME_SECTION_TYPES,
  LinkTarget,
  type HomeSection,
} from '@/features/cms/settings/schema';
import { TiptapDoc } from '@/lib/rich-text/schema';

/**
 * Per-type settings for homepage sections (spec §6.3). Client-safe: the Phase 5 homepage builder
 * validates with these in the browser, and the loaders validate again on the server.
 */

export type HomeSectionType = (typeof HOME_SECTION_TYPES)[number];

const uuid = z.uuid();
const heading = (max = 80) => z.string().trim().min(1).max(max);

/** A call-to-action: visible label plus a site path, https link or CMS page. */
export const CtaLink = z.object({ label: z.string().trim().min(1).max(40) }).and(LinkTarget);

export const ICON_KEYS = [
  'graduation-cap',
  'school',
  'book-open',
  'users',
  'calendar',
  'clock',
  'map-pin',
  'phone',
  'trophy',
  'award',
  'globe',
  'heart',
  'music',
  'flask',
  'bus',
  'home',
] as const;
export const IconKey = z.enum(ICON_KEYS);
export type IconKey = z.infer<typeof IconKey>;

export const SECTION_SETTINGS = {
  hero: z.object({
    slides: z
      .array(
        z.object({
          mediaId: uuid,
          heading: heading(80),
          subheading: z.string().trim().max(160).optional(),
          cta: CtaLink.optional(),
        }),
      )
      .min(1)
      .max(5),
    autoplaySeconds: z.number().int().min(4).max(15).nullable().default(7),
  }),
  introduction: z.object({
    heading: heading(100),
    body: TiptapDoc,
    imageMediaId: uuid.nullable().default(null),
    cta: CtaLink.optional(),
  }),
  quickInfo: z.object({
    heading: z.string().trim().max(80).optional(),
    items: z
      .array(
        z.object({
          icon: IconKey,
          label: z.string().trim().min(1).max(40),
          value: z.string().trim().min(1).max(60),
          href: z
            .string()
            .regex(/^(\/|https:\/\/|mailto:|tel:)/)
            .optional(),
        }),
      )
      .min(1)
      .max(6),
  }),
  latestNews: z.object({
    heading: heading(80).default('Latest news'),
    count: z.number().int().min(2).max(6).default(3),
    categoryId: uuid.nullable().default(null),
  }),
  upcomingEvents: z.object({
    heading: heading(80).default('Upcoming events'),
    count: z.number().int().min(2).max(6).default(3),
  }),
  academicOverview: z.object({
    heading: heading(80).default('Academics'),
    intro: z.string().trim().max(300).optional(),
  }),
  galleryPreview: z.object({
    heading: heading(80).default('School life'),
    source: z.enum(['latest', 'album']).default('latest'),
    albumId: uuid.nullable().default(null),
  }),
  admissionsCta: z.object({
    heading: heading(80),
    body: z.string().trim().max(300),
    ctaLabel: z.string().trim().min(1).max(30).default('Apply now'),
  }),
  leadershipMessage: z.object({
    heading: heading(80),
    staffId: uuid,
    message: TiptapDoc,
  }),
  statistics: z.object({
    heading: z.string().trim().max(80).optional(),
    items: z
      .array(
        z.object({
          value: z.string().trim().min(1).max(20),
          label: z.string().trim().min(1).max(60),
        }),
      )
      .min(2)
      .max(6),
  }),
  testimonials: z.object({
    heading: heading(80).default('What families say'),
    items: z
      .array(
        z.object({
          quote: z.string().trim().min(1).max(400),
          name: z.string().trim().min(1).max(80),
          role: z.string().trim().max(80).optional(),
          imageMediaId: uuid.optional(),
        }),
      )
      .min(1)
      .max(6),
  }),
  customRichText: z.object({
    heading: z.string().trim().max(100).optional(),
    body: TiptapDoc,
    layout: z.enum(['narrow', 'wide']).default('narrow'),
  }),
} satisfies { [K in HomeSectionType]: z.ZodType };

export type SectionSettings = {
  [K in HomeSectionType]: z.output<(typeof SECTION_SETTINGS)[K]>;
};

/** How many of each section a homepage may hold (spec §6.3). */
export const SECTION_MAX: Record<HomeSectionType, number> = {
  hero: 1,
  introduction: 1,
  quickInfo: 1,
  latestNews: 1,
  upcomingEvents: 1,
  academicOverview: 1,
  galleryPreview: 1,
  admissionsCta: 1,
  leadershipMessage: 1,
  statistics: 1,
  testimonials: 1,
  customRichText: 5,
};

export type ParsedSection = {
  [K in HomeSectionType]: { id: string; type: K; settings: SectionSettings[K] };
}[HomeSectionType];

/** Validate one stored section against its type's schema. Invalid sections are skipped, not fatal. */
export function parseSection(section: HomeSection): ParsedSection | null {
  const result = SECTION_SETTINGS[section.type].safeParse(section.settings);
  if (!result.success) return null;
  return { id: section.id, type: section.type, settings: result.data } as ParsedSection;
}
