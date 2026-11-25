import 'server-only';
import type { SiteSettings } from '@/features/cms/settings/schema';
import { renderRichText } from '@/lib/rich-text/render';
import type { SectionData } from '../types';
import { pageIdsOf, resolveLink } from './links';
import { getOpenIntake } from './loaders/intakes';
import { getImageRefs } from './loaders/media';
import { getPagePaths } from './loaders/pages';
import type { HomeSectionType, ParsedSection, SectionSettings } from './section-settings';

/**
 * Server side of the section registry (spec §6.3): each section type's loader turns stored
 * settings into the presentation-ready data templates receive. A loader returns null when there
 * is nothing to show, and the homepage then skips the section.
 */

export interface LoadContext {
  settings: SiteSettings;
}

type Loader<K extends HomeSectionType> = (
  settings: SectionSettings[K],
  ctx: LoadContext,
) => Promise<SectionData[K] | null>;

/** Module sections whose content tables arrive in a later phase render nothing until then. */
const awaitingModule = () => Promise.resolve(null);

export const sectionLoaders: { [K in HomeSectionType]: Loader<K> } = {
  async hero(s) {
    const ctas = s.slides.flatMap((slide) => (slide.cta ? [slide.cta] : []));
    const [images, paths] = await Promise.all([
      getImageRefs(s.slides.map((slide) => slide.mediaId)),
      getPagePaths(pageIdsOf(ctas)),
    ]);
    const slides = s.slides.flatMap((slide) => {
      const image = images[slide.mediaId];
      if (!image) return [];
      const cta = slide.cta ? resolveLink(slide.cta, paths) : null;
      return [
        {
          image,
          heading: slide.heading,
          ...(slide.subheading ? { subheading: slide.subheading } : {}),
          ...(cta ? { cta } : {}),
        },
      ];
    });
    return slides.length > 0 ? { slides, autoplaySeconds: s.autoplaySeconds } : null;
  },

  async introduction(s) {
    const body = renderRichText(s.body);
    if (!body) return null;
    const [images, paths] = await Promise.all([
      getImageRefs(s.imageMediaId ? [s.imageMediaId] : []),
      getPagePaths(s.cta ? pageIdsOf([s.cta]) : []),
    ]);
    const cta = s.cta ? resolveLink(s.cta, paths) : null;
    return {
      heading: s.heading,
      body,
      image: (s.imageMediaId && images[s.imageMediaId]) || null,
      ...(cta ? { cta } : {}),
    };
  },

  quickInfo(s) {
    return Promise.resolve({
      ...(s.heading ? { heading: s.heading } : {}),
      items: s.items.map((item) => ({
        icon: item.icon,
        label: item.label,
        value: item.value,
        ...(item.href ? { href: item.href } : {}),
      })),
    });
  },

  // Real loaders arrive with their modules: News (Phase 6), Academics (7), Events (8),
  // Gallery (9) and Staff (10). Until then the demo gallery shows these sections with fixtures.
  latestNews: awaitingModule,
  academicOverview: awaitingModule,
  upcomingEvents: awaitingModule,
  galleryPreview: awaitingModule,
  leadershipMessage: awaitingModule,

  async admissionsCta(s, { settings }) {
    if (!settings.admissions.enabled) return null;
    const intake = await getOpenIntake();
    return {
      heading: s.heading,
      body: s.body,
      openIntake: intake,
      cta: { label: s.ctaLabel, href: intake?.href ?? '/admissions', external: false },
    };
  },

  statistics(s) {
    return Promise.resolve({
      ...(s.heading ? { heading: s.heading } : {}),
      items: s.items.map((item) => ({ value: item.value, label: item.label })),
    });
  },

  async testimonials(s) {
    const images = await getImageRefs(
      s.items.flatMap((i) => (i.imageMediaId ? [i.imageMediaId] : [])),
    );
    return {
      heading: s.heading,
      items: s.items.map((item) => ({
        quote: item.quote,
        name: item.name,
        ...(item.role ? { role: item.role } : {}),
        image: (item.imageMediaId && images[item.imageMediaId]) || null,
      })),
    };
  },

  customRichText(s) {
    const body = renderRichText(s.body);
    return Promise.resolve(
      body ? { ...(s.heading ? { heading: s.heading } : {}), body, layout: s.layout } : null,
    );
  },
};

/** Loads one parsed section's data (null = skip it). */
export function loadSection(
  section: ParsedSection,
  ctx: LoadContext,
): Promise<SectionData[HomeSectionType] | null> {
  // The registry is keyed by type, so the settings always match their loader.
  const loader = sectionLoaders[section.type] as Loader<HomeSectionType>;
  return loader(section.settings, ctx);
}
