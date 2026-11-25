import type { TemplateDefinition } from '../types';
import { HeritageFooter } from './footer';
import { HeritageHeader } from './header';
import { HeritagePageFrame } from './page-frame';
import { HeritageHero } from './sections/hero';
import { HeritageLeadership } from './sections/leadership';
import { HeritageTimeline } from './sections/timeline';

export const heritagePrestige: TemplateDefinition = {
  key: 'heritage-prestige',
  label: 'Heritage & Prestige',
  description:
    'Elegant and historic: a refined serif, a timeline of milestones and prominent leadership.',
  Header: HeritageHeader,
  Footer: HeritageFooter,
  PageFrame: HeritagePageFrame,
  sections: {
    hero: HeritageHero,
    statistics: HeritageTimeline,
    leadershipMessage: HeritageLeadership,
  },
  homeTitle: 'hero',
  defaults: {
    fontHeading: 'playfair-display',
    fontBody: 'lora',
    radius: 'none',
    homepageOrder: [
      'hero',
      'introduction',
      'statistics',
      'leadershipMessage',
      'academicOverview',
      'testimonials',
      'galleryPreview',
      'latestNews',
      'upcomingEvents',
      'quickInfo',
      'admissionsCta',
      'customRichText',
    ],
  },
};
