import type { TemplateDefinition } from '../types';
import { CommunityFooter } from './footer';
import { CommunityHeader } from './header';
import { CommunityPageFrame } from './page-frame';
import { CommunityEvents } from './sections/events';
import { CommunityHero } from './sections/hero';
import { CommunityQuickInfo } from './sections/quick-info';

export const contemporaryCommunity: TemplateDefinition = {
  key: 'contemporary-community',
  label: 'Contemporary Community',
  description: 'Warm and friendly: rounded cards, events first and lots of school life.',
  Header: CommunityHeader,
  Footer: CommunityFooter,
  PageFrame: CommunityPageFrame,
  sections: { hero: CommunityHero, upcomingEvents: CommunityEvents, quickInfo: CommunityQuickInfo },
  homeTitle: 'hero',
  defaults: {
    fontHeading: 'nunito-sans',
    fontBody: 'nunito-sans',
    radius: 'lg',
    homepageOrder: [
      'hero',
      'upcomingEvents',
      'quickInfo',
      'galleryPreview',
      'latestNews',
      'introduction',
      'testimonials',
      'academicOverview',
      'statistics',
      'leadershipMessage',
      'admissionsCta',
      'customRichText',
    ],
  },
};
