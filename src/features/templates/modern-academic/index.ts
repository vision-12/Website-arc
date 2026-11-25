import type { TemplateDefinition } from '../types';
import { ModernFooter } from './footer';
import { ModernHeader } from './header';
import { ModernPageFrame } from './page-frame';
import { ModernHero } from './sections/hero';
import { ModernIntroduction } from './sections/introduction';
import { ModernStatistics } from './sections/statistics';

export const modernAcademic: TemplateDefinition = {
  key: 'modern-academic',
  label: 'Modern Academic',
  description:
    'Spacious and editorial: large photographs, generous white space and a modern sans-serif.',
  Header: ModernHeader,
  Footer: ModernFooter,
  PageFrame: ModernPageFrame,
  sections: { hero: ModernHero, introduction: ModernIntroduction, statistics: ModernStatistics },
  homeTitle: 'hero',
  defaults: {
    fontHeading: 'dm-sans',
    fontBody: 'inter',
    radius: 'md',
    homepageOrder: [
      'hero',
      'introduction',
      'statistics',
      'academicOverview',
      'latestNews',
      'galleryPreview',
      'leadershipMessage',
      'upcomingEvents',
      'testimonials',
      'quickInfo',
      'admissionsCta',
      'customRichText',
    ],
  },
};
