import type { TemplateDefinition } from '../types';
import { InstitutionalFooter } from './footer';
import { InstitutionalHeader } from './header';
import { InstitutionalPageFrame } from './page-frame';
import { InstitutionalHero } from './sections/hero';
import { InstitutionalLatestNews } from './sections/latest-news';
import { InstitutionalQuickInfo } from './sections/quick-info';

export const institutionalClassic: TemplateDefinition = {
  key: 'institutional-classic',
  label: 'Institutional Classic',
  description:
    'Formal and structured: a contact bar, a centred crest, serif headings and a clear grid.',
  Header: InstitutionalHeader,
  Footer: InstitutionalFooter,
  PageFrame: InstitutionalPageFrame,
  sections: {
    hero: InstitutionalHero,
    quickInfo: InstitutionalQuickInfo,
    latestNews: InstitutionalLatestNews,
  },
  homeTitle: 'hero',
  defaults: {
    fontHeading: 'source-serif-4',
    fontBody: 'inter',
    radius: 'sm',
    homepageOrder: [
      'hero',
      'quickInfo',
      'introduction',
      'academicOverview',
      'latestNews',
      'statistics',
      'leadershipMessage',
      'upcomingEvents',
      'galleryPreview',
      'testimonials',
      'admissionsCta',
      'customRichText',
    ],
  },
};
