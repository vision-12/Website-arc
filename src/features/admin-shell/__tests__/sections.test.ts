import { describe, expect, it } from 'vitest';
import { t } from '@/lib/i18n/t';
import { ADMIN_SECTIONS, findSection, visibleSections } from '../sections';

describe('admin sections (PRD §6.2)', () => {
  it('lists the 15 PRD sections in order, then Trash (spec §5.4)', () => {
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
      'Trash',
    ]);
  });

  it('shows only permitted sections, plus the overview', () => {
    const keys = visibleSections(new Set(['events.view', 'media.view'])).map((s) => s.key);
    expect(keys).toEqual(['overview', 'events', 'media']);
    expect(visibleSections('all')).toHaveLength(16);
  });

  it('shows Trash to anyone who can delete something', () => {
    expect(visibleSections(new Set(['media.view', 'media.delete'])).map((s) => s.key)).toContain(
      'trash',
    );
    expect(visibleSections(new Set(['pages.view', 'pages.edit'])).map((s) => s.key)).not.toContain(
      'trash',
    );
  });

  it('finds sections by key', () => {
    expect(findSection('news')?.href).toBe('/admin/news');
    expect(findSection('nope')).toBeUndefined();
  });
});
