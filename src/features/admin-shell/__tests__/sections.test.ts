import { describe, expect, it } from 'vitest';
import { t } from '@/lib/i18n/t';
import { ADMIN_SECTIONS, findSection, visibleSections } from '../sections';

describe('admin sections (PRD §6.2)', () => {
  it('lists the 15 PRD sections in order', () => {
    expect(ADMIN_SECTIONS.map((s) => t(s.labelKey))).toEqual([
      'Overview',
      'Website pages',
      'News & announcements',
      'Admissions',
      'Academic programmes',
      'Events calendar',
      'Gallery',
      'Staff directory',
      'Resource centre',
      'Contact enquiries',
      'Media library',
      'Website appearance',
      'Users & permissions',
      'Settings',
      'Activity log',
    ]);
  });

  it('shows only permitted sections, plus the overview', () => {
    const keys = visibleSections(new Set(['events.view', 'media.view'])).map((s) => s.key);
    expect(keys).toEqual(['overview', 'events', 'media']);
    expect(visibleSections('all')).toHaveLength(15);
  });

  it('finds sections by key', () => {
    expect(findSection('news')?.href).toBe('/admin/news');
    expect(findSection('nope')).toBeUndefined();
  });
});
