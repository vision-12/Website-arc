import type { SiteSettings } from './schema';

/**
 * Neutral, deliberately unbranded settings used until a school's `site_settings` row exists
 * (Phase 1 has no database). Greyscale only — nothing here identifies any school.
 * Allow-listed in scripts/check-school-values.mjs.
 */
export const FALLBACK_SETTINGS: SiteSettings = {
  identity: {
    name: 'School website',
    shortName: 'School',
    logoMediaId: null,
    faviconMediaId: null,
    schoolType: 'secondary',
    curricula: ['UNEB'],
  },
  theme: {
    template: 'institutional-classic',
    primary: '#1f2937',
    secondary: '#4b5563',
    fontHeading: 'source-serif-4',
    fontBody: 'inter',
    radius: 'md',
    density: 'comfortable',
  },
  navigation: [],
  homepage: [],
  footer: { columns: [] },
  contact: {
    phones: [],
    emails: [],
    address: '',
    hours: [],
    geo: null,
    mapZoom: 15,
    enquirySubjects: ['General enquiry'],
    phoneRequired: false,
  },
  social: [],
  admissions: {
    enabled: false,
    referencePrefix: 'APP',
    maxFileSizeMb: 10,
    maxFiles: 10,
    acknowledgementMessage: '',
    closedMessage: '',
    pendingAlertDays: 7,
    infoRequestLinkDays: 7,
  },
  seo: {
    defaultTitleTemplate: '%s',
    defaultDescription: '',
    ogImageMediaId: null,
    indexable: false,
  },
  locale: { timezone: 'Africa/Kampala', dateFormat: 'd MMM yyyy' },
  features: { admissionsTracking: false, contentApproval: false, mfaRequiredForAdmins: false },
  attribution: { showAltrastateCredit: true },
  content: { maxFeaturedNews: 3, allowOfficeDocs: false },
  legal: { privacyPageId: null, termsPageId: null, consentTextVersion: 'unset' },
};

export const FALLBACK_VERSION = 0;
