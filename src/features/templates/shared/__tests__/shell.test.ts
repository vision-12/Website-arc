import { describe, expect, it, vi } from 'vitest';
import type { SiteSettings } from '@/features/cms/settings/schema';
import { seededSettings } from '../../../../../test/support/demo-settings';

// buildShell is pure; its async wrapper's loaders (database, env) are not under test here.
vi.mock('../loaders/media', () => ({ getImageRefs: vi.fn() }));
vi.mock('../loaders/pages', () => ({ getPagePaths: vi.fn() }));

const { buildShell } = await import('../shell');

const PUBLISHED = '6a1d2c3b-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const DRAFT = '7b2e3d4c-5f6a-4b7c-9d8e-0f1a2b3c4d5e';
const LOGO = '8c3f4e5d-6a7b-4c8d-ae9f-1a2b3c4d5e6f';

function settingsWith(patch: Partial<SiteSettings>): SiteSettings {
  return { ...seededSettings(), ...patch };
}

describe('buildShell: what headers and footers receive', () => {
  const settings = settingsWith({
    navigation: [
      {
        id: 'a',
        label: 'About',
        visible: true,
        pageId: PUBLISHED,
        children: [
          { id: 'a1', label: 'History', visible: true, href: '/about/history' },
          { id: 'a2', label: 'Hidden child', visible: false, href: '/about/secret' },
          { id: 'a3', label: 'Draft child', visible: true, pageId: DRAFT },
        ],
      },
      { id: 'b', label: 'Hidden', visible: false, href: '/hidden', children: [] },
      { id: 'c', label: 'Draft page', visible: true, pageId: DRAFT, children: [] },
      {
        id: 'd',
        label: 'Parent without a page',
        visible: true,
        pageId: DRAFT,
        children: [{ id: 'd1', label: 'Fees', visible: true, href: '/admissions/fees' }],
      },
      { id: 'e', label: 'News', visible: true, href: 'https://news.example.org', children: [] },
    ],
    footer: {
      blurb: 'A school',
      columns: [
        {
          heading: 'School',
          links: [{ id: 'f1', label: 'About', visible: true, pageId: PUBLISHED }],
        },
        { heading: 'Empty', links: [{ id: 'f2', label: 'Draft', visible: true, pageId: DRAFT }] },
      ],
    },
  });
  settings.identity = { ...settings.identity, logoMediaId: LOGO };
  const logo = { src: '/logo.webp', width: 200, height: 80, alt: 'Crest' };
  const shell = buildShell(settings, 2026, { [PUBLISHED]: '/about' }, { [LOGO]: logo });

  it('keeps visible items in order and resolves page links', () => {
    expect(shell.navigation.map((i) => [i.label, i.href])).toEqual([
      ['About', '/about'],
      ['Parent without a page', null],
      ['News', 'https://news.example.org'],
    ]);
  });

  it('drops hidden items and links to unpublished pages, children included', () => {
    expect(shell.navigation[0]?.children.map((c) => c.label)).toEqual(['History']);
    expect(shell.navigation[1]?.children.map((c) => c.label)).toEqual(['Fees']);
  });

  it('marks external links', () => {
    expect(shell.navigation[2]?.external).toBe(true);
    expect(shell.navigation[0]?.external).toBe(false);
  });

  it('leaves out footer columns with nothing to link to', () => {
    expect(shell.footer.columns).toEqual([
      { heading: 'School', links: [{ label: 'About', href: '/about', external: false }] },
    ]);
  });

  it('resolves the logo and the year', () => {
    expect(shell.identity.logo).toEqual(logo);
    expect(shell.year).toBe(2026);
  });
});
