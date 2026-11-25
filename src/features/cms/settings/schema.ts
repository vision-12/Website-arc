import { z } from '@/lib/zod';
import { FONT_KEYS } from '@/lib/fonts/keys';

/** `site_settings` contract — MASTER_PROMPT §3.2 plus spec §1.3 extensions. Shared client/server. */

export const HexColour = z
  .string()
  .regex(
    /^#[0-9a-fA-F]{6}$/,
    'Use a six-digit colour code: a hash sign followed by six letters or digits',
  )
  .transform((v) => v.toLowerCase());
export const FontKey = z.enum(FONT_KEYS);
const uuid = z.uuid();
/** Where a link points: a site path / https URL, or a CMS page (resolved to its path when rendered). */
export const LinkTarget = z.union([
  z.object({
    href: z.string().regex(/^(\/|https:\/\/|mailto:|tel:)/, 'Use a site path or an https:// link'),
  }),
  z.object({ pageId: uuid }),
]);

const NavLeaf = z
  .object({ id: z.string(), label: z.string().min(1).max(40), visible: z.boolean() })
  .and(LinkTarget);
export const NavItem = z
  .object({
    id: z.string(),
    label: z.string().min(1).max(40),
    visible: z.boolean(),
    children: z.array(NavLeaf).max(12).default([]),
  })
  .and(LinkTarget);

export const HOME_SECTION_TYPES = [
  'hero',
  'introduction',
  'quickInfo',
  'latestNews',
  'upcomingEvents',
  'academicOverview',
  'galleryPreview',
  'admissionsCta',
  'leadershipMessage',
  'statistics',
  'testimonials',
  'customRichText',
] as const;
export const HomeSectionType = z.enum(HOME_SECTION_TYPES);
/** Per-type `settings` are validated by the section registry (Phase 5). */
export const HomeSection = z.object({
  id: z.string().min(1),
  type: HomeSectionType,
  visible: z.boolean(),
  settings: z.record(z.string(), z.unknown()),
});

export const SocialLink = z.object({
  network: z.enum(['facebook', 'x', 'instagram', 'youtube', 'linkedin', 'tiktok', 'whatsapp']),
  url: z.url().startsWith('https://'),
});

const Phone = z.string().regex(/^\+[1-9]\d{7,14}$/, 'Use international format, e.g. +2567…');
export const ContactConfig = z.object({
  phones: z.array(z.object({ label: z.string().max(40), number: Phone })).max(6),
  emails: z.array(z.object({ label: z.string().max(40), address: z.email() })).max(6),
  address: z.string().max(300),
  hours: z.array(z.object({ days: z.string().max(40), times: z.string().max(40) })).max(7),
  geo: z
    .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
    .nullable(),
  mapZoom: z.number().int().min(1).max(20).default(15),
  enquirySubjects: z.array(z.string().min(2).max(60)).min(1).max(12),
  phoneRequired: z.boolean().default(false),
});

export const FooterConfig = z.object({
  blurb: z.string().max(400).optional(),
  columns: z
    .array(z.object({ heading: z.string().max(40), links: z.array(NavLeaf).max(10) }))
    .max(4),
  copyrightName: z.string().max(120).optional(),
});

export const AdmissionsConfig = z.object({
  enabled: z.boolean(),
  referencePrefix: z.string().regex(/^[A-Z]{2,4}$/),
  maxFileSizeMb: z.number().int().min(1).max(20).default(10),
  maxFiles: z.number().int().min(1).max(10).default(10),
  acknowledgementMessage: z.string().max(600),
  closedMessage: z.string().max(600),
  pendingAlertDays: z.number().int().min(1).max(60).default(7),
  infoRequestLinkDays: z.number().int().min(1).max(30).default(7),
});

export const Theme = z.object({
  template: z.enum([
    'institutional-classic',
    'modern-academic',
    'heritage-prestige',
    'contemporary-community',
  ]),
  primary: HexColour,
  secondary: HexColour,
  accent: HexColour.optional(),
  fontHeading: FontKey,
  fontBody: FontKey,
  radius: z.enum(['none', 'sm', 'md', 'lg']),
  density: z.enum(['comfortable', 'compact']),
});

export const SiteSettings = z.object({
  identity: z.object({
    name: z.string().min(2).max(120),
    shortName: z.string().max(20),
    motto: z.string().max(160).optional(),
    logoMediaId: uuid.nullable(),
    faviconMediaId: uuid.nullable(),
    foundedYear: z.number().int().min(1800).max(2100).optional(),
    schoolType: z.enum(['nursery', 'primary', 'secondary', 'tertiary', 'international', 'mixed']),
    curricula: z.array(z.enum(['UNEB', 'Cambridge', 'IB', 'Other'])).default(['UNEB']),
  }),
  theme: Theme,
  navigation: z.array(NavItem).max(10),
  homepage: z.array(HomeSection).max(20),
  footer: FooterConfig,
  contact: ContactConfig,
  social: z.array(SocialLink).max(8),
  admissions: AdmissionsConfig,
  seo: z.object({
    defaultTitleTemplate: z.string().max(80),
    defaultDescription: z.string().max(160),
    ogImageMediaId: uuid.nullable(),
    indexable: z.boolean(),
  }),
  locale: z.object({
    timezone: z.string().default('Africa/Kampala'),
    dateFormat: z.string().default('d MMM yyyy'),
  }),
  features: z.object({
    admissionsTracking: z.boolean(),
    contentApproval: z.boolean(),
    mfaRequiredForAdmins: z.boolean(),
  }),
  attribution: z.object({ showAltrastateCredit: z.boolean() }),
  content: z.object({
    maxFeaturedNews: z.number().int().min(1).max(6).default(3),
    allowOfficeDocs: z.boolean().default(false),
  }),
  legal: z.object({
    privacyPageId: uuid.nullable(),
    termsPageId: uuid.nullable(),
    consentTextVersion: z.string().min(1),
  }),
});

export type SiteSettings = z.infer<typeof SiteSettings>;
export type Theme = z.infer<typeof Theme>;
export type HomeSection = z.infer<typeof HomeSection>;
