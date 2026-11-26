import { describe, expect, it } from 'vitest';
import { dashboardTiles, type DashboardCounts } from '../tiles';

const counts: DashboardCounts = {
  pagesInReview: 2,
  pagesScheduledSoon: 1,
  pagesStaleDrafts: 0,
  mediaMissingAlt: 3,
  trashPages: 4,
  trashMedia: 1,
};
const role =
  (...perms: string[]) =>
  (p: string) =>
    perms.includes(p);

describe('dashboard tiles (MP §5.10, plan P4-K)', () => {
  it('shows a content editor what needs doing, in plain words, with links to filtered lists', () => {
    const tiles = dashboardTiles(
      counts,
      role('pages.view', 'pages.edit', 'pages.delete', 'media.edit', 'media.delete'),
      false,
    );
    expect(tiles.map((t) => t.label)).toEqual([
      '1 page going live in the next 48 hours',
      '0 drafts not touched for 30 days',
      '3 photos need a description',
      '5 items in Trash',
    ]);
    expect(tiles.find((t) => t.key === 'mediaMissingAlt')).toMatchObject({
      attention: true,
      href: { pathname: '/admin/media', query: { filter: 'missing-description' } },
    });
  });

  it('shows the approval tile only to approvers, and only when approval is on', () => {
    const headteacher = role('pages.view', 'pages.approve');
    expect(dashboardTiles(counts, headteacher, true)[0]).toMatchObject({
      key: 'pagesInReview',
      label: '2 pages waiting for your approval',
      attention: true,
    });
    expect(dashboardTiles(counts, headteacher, false).map((t) => t.key)).not.toContain(
      'pagesInReview',
    );
  });

  it('shows nothing for content to someone with no content permissions', () => {
    expect(dashboardTiles(counts, role('admissions.view'), true)).toEqual([]);
  });

  it('counts only the Trash the person can act on', () => {
    expect(dashboardTiles(counts, role('media.delete'), false)).toMatchObject([
      { key: 'trash', count: 1 },
    ]);
  });
});
