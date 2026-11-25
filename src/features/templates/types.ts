import type { ComponentType, ReactNode } from 'react';
import type { SiteSettings, Theme } from '@/features/cms/settings/schema';
import type { FontKey } from '@/lib/fonts/keys';
import type { HomeSectionType, IconKey } from './shared/section-settings';

/**
 * The template contract (spec §6.1). Templates are presentation only: they receive the fully
 * resolved, typed data below and never fetch. That is what lets a school switch templates
 * without touching content (MP §3.3, PRD §8.3).
 */

export type TemplateKey = Theme['template'];

export interface ImageRef {
  src: string;
  width: number;
  height: number;
  alt: string;
  /** Tiny blurred preview (data URL) shown while the image loads. */
  lqip?: string;
}

export interface ResolvedLink {
  label: string;
  href: string;
  external: boolean;
}

export interface ResolvedNavItem {
  id: string;
  label: string;
  /** Null when the item's own page isn't published but it still has visible sub-items. */
  href: string | null;
  external: boolean;
  children: (ResolvedLink & { id: string })[];
}

export interface ShellData {
  identity: SiteSettings['identity'] & { logo: ImageRef | null };
  navigation: ResolvedNavItem[];
  footer: {
    blurb?: string;
    columns: { heading: string; links: ResolvedLink[] }[];
    copyrightName: string;
  };
  contact: SiteSettings['contact'];
  social: SiteSettings['social'];
  attribution: SiteSettings['attribution'];
  /** Shows the "Apply" entry point; admissions themselves arrive in Phase 12. */
  admissionsEnabled: boolean;
  /** For the copyright line; computed once in a cached helper. */
  year: number;
}

/** Rich text already rendered by the shared static renderer. Templates never see Tiptap JSON. */
export type RenderedRichText = ReactNode;

export interface HeroSlide {
  image: ImageRef;
  heading: string;
  subheading?: string;
  cta?: ResolvedLink;
}
export interface NewsCard {
  title: string;
  href: string;
  excerpt?: string;
  /** ISO timestamp; formatted in the school's timezone. */
  publishedAt: string;
  category?: string;
  image: ImageRef | null;
}
export interface EventCard {
  title: string;
  href: string;
  startsAt: string;
  endsAt?: string;
  allDay: boolean;
  venue?: string;
  category?: string;
}
export interface LevelCard {
  name: string;
  href: string;
  summary?: string;
  image: ImageRef | null;
}
export interface PersonCard {
  name: string;
  role: string;
  image: ImageRef | null;
  href?: string;
}
export interface IntakeCard {
  name: string;
  href: string;
  closesAt: string;
}

export interface SectionData {
  hero: { slides: HeroSlide[]; autoplaySeconds: number | null };
  introduction: {
    heading: string;
    body: RenderedRichText;
    image: ImageRef | null;
    cta?: ResolvedLink;
  };
  quickInfo: {
    heading?: string;
    items: { icon: IconKey; label: string; value: string; href?: string }[];
  };
  latestNews: { heading: string; articles: NewsCard[]; viewAllHref: string };
  upcomingEvents: { heading: string; events: EventCard[]; viewAllHref: string };
  academicOverview: { heading: string; intro?: string; levels: LevelCard[]; viewAllHref: string };
  galleryPreview: { heading: string; images: ImageRef[]; viewAllHref: string };
  admissionsCta: {
    heading: string;
    body: string;
    openIntake: IntakeCard | null;
    cta: ResolvedLink;
  };
  leadershipMessage: {
    heading: string;
    person: PersonCard;
    message: RenderedRichText;
    cta?: ResolvedLink;
  };
  statistics: { heading?: string; items: { value: string; label: string }[] };
  testimonials: {
    heading: string;
    items: { quote: string; name: string; role?: string; image: ImageRef | null }[];
  };
  customRichText: { heading?: string; body: RenderedRichText; layout: 'narrow' | 'wide' };
}

export interface SectionLocale {
  timezone: string;
  dateFormat: string;
}

export interface SectionProps<T extends HomeSectionType> {
  id: string;
  data: SectionData[T];
  locale: SectionLocale;
  /**
   * Set only on the hero, and only when the template puts the homepage's single h1 (the school's
   * name) in the hero. Otherwise the page renders a visually hidden h1.
   */
  schoolNameAsH1?: string;
}

export type SectionComponent<T extends HomeSectionType> = ComponentType<SectionProps<T>>;

export type SectionComponents = { [K in HomeSectionType]?: SectionComponent<K> };

export interface Crumb {
  label: string;
  href?: string;
}

export interface PageFrameProps {
  layout: 'default' | 'wide' | 'with_sidebar';
  title: string;
  breadcrumbs: Crumb[];
  sidebar?: ReactNode;
  children: ReactNode;
}

export interface TemplateDefinition {
  key: TemplateKey;
  label: string;
  description: string;
  Header: ComponentType<{ shell: ShellData }>;
  Footer: ComponentType<{ shell: ShellData }>;
  PageFrame: ComponentType<PageFrameProps>;
  /** Sections this template designs itself; any other type uses the shared fallback. */
  sections: SectionComponents;
  /** Where the homepage's h1 (the school's name) appears. */
  homeTitle: 'hero' | 'hidden';
  /** Used only when provisioning a new school; never applied when a school switches template. */
  defaults: {
    fontHeading: FontKey;
    fontBody: FontKey;
    radius: Theme['radius'];
    homepageOrder: HomeSectionType[];
  };
}
