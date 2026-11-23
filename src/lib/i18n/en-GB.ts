/** UK-English UI strings (MP §1). Every admin/public UI string goes through t() so languages can be added later (Q6). */
export const enGB = {
  common: {
    skipToContent: 'Skip to main content',
    close: 'Close',
    cancel: 'Cancel',
    openMenu: 'Open menu',
    viewWebsite: 'View website',
    account: 'Your account',
    signOut: 'Sign out',
    comingSoon: 'Not available yet',
    offline: 'You are offline. Changes will not be saved until your connection returns.',
  },
  saveState: {
    saved: 'All changes saved',
    saving: 'Saving…',
    unsaved: 'Not saved — check your connection',
  },
  status: {
    draft: 'Draft',
    in_review: 'Waiting for approval',
    scheduled: 'Scheduled',
    published: 'On website',
    archived: 'Archived',
  },
  admin: {
    title: 'School administration',
    navLabel: 'Administration sections',
    sections: {
      overview: 'Overview',
      pages: 'Website pages',
      news: 'News & announcements',
      admissions: 'Admissions',
      academics: 'Academic programmes',
      events: 'Events calendar',
      gallery: 'Gallery',
      staff: 'Staff directory',
      resources: 'Resource centre',
      enquiries: 'Contact enquiries',
      media: 'Media library',
      appearance: 'Website appearance',
      users: 'Users & permissions',
      settings: 'Settings',
      activity: 'Activity log',
    },
    overview: {
      heading: 'Overview',
      emptyTitle: 'Your dashboard is getting ready',
      emptyBody:
        'This page will show applications waiting for a decision, new enquiries, upcoming events and recent changes to the website.',
    },
    sectionEmpty: {
      title: 'This section is not available yet',
      body: 'It will appear here once it has been set up for your school.',
    },
  },
  public: {
    placeholderTitle: 'This website is being prepared',
    placeholderBody: 'Please check back soon.',
  },
} as const;

export type Messages = typeof enGB;
