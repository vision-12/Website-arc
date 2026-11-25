import type { SectionComponent } from '../../types';
import type { HomeSectionType } from '../section-settings';
import {
  FallbackCustomRichText,
  FallbackIntroduction,
  FallbackLeadershipMessage,
  FallbackTestimonials,
} from './content';
import { FallbackAdmissionsCta, FallbackQuickInfo, FallbackStatistics } from './facts';
import { FallbackHero } from './hero';
import {
  FallbackAcademicOverview,
  FallbackGalleryPreview,
  FallbackLatestNews,
  FallbackUpcomingEvents,
} from './modules';

/**
 * Shared, token-styled renderers for every section type. A template that doesn't design a section
 * itself gets these, so switching templates never drops content (spec §6.3).
 */
export const fallbackSections: { [K in HomeSectionType]: SectionComponent<K> } = {
  hero: FallbackHero,
  introduction: FallbackIntroduction,
  quickInfo: FallbackQuickInfo,
  latestNews: FallbackLatestNews,
  upcomingEvents: FallbackUpcomingEvents,
  academicOverview: FallbackAcademicOverview,
  galleryPreview: FallbackGalleryPreview,
  admissionsCta: FallbackAdmissionsCta,
  leadershipMessage: FallbackLeadershipMessage,
  statistics: FallbackStatistics,
  testimonials: FallbackTestimonials,
  customRichText: FallbackCustomRichText,
};
