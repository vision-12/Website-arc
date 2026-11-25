import type { Route } from 'next';

/**
 * The dashboard is actionable, not decorative (MP §5.10): every tile says what needs doing and
 * links to the filtered list. Tiles appear only for modules that exist and only for people who can
 * act on them (plan P4-K); each module phase adds its own here.
 */

export interface DashboardCounts {
  pagesInReview: number;
  pagesScheduledSoon: number;
  pagesStaleDrafts: number;
  mediaMissingAlt: number;
  trashPages: number;
  trashMedia: number;
}

export interface Tile {
  key: string;
  count: number;
  label: string;
  hint: string;
  href: { pathname: Route; query?: Record<string, string> };
  /** Needs someone to act (approval waiting, photos without descriptions). */
  attention: boolean;
}

const plural = (n: number, one: string, many: string) =>
  n === 1 ? one : many.replace('{n}', String(n));

export function dashboardTiles(
  c: DashboardCounts,
  has: (permission: string) => boolean,
  approval: boolean,
): Tile[] {
  const tiles: Tile[] = [];
  if (approval && has('pages.approve'))
    tiles.push({
      key: 'pagesInReview',
      count: c.pagesInReview,
      label: plural(
        c.pagesInReview,
        '1 page waiting for your approval',
        '{n} pages waiting for your approval',
      ),
      hint: 'Check them and publish, or send them back with a note.',
      href: { pathname: '/admin/pages', query: { status: 'in_review' } },
      attention: c.pagesInReview > 0,
    });
  if (has('pages.view'))
    tiles.push({
      key: 'pagesScheduledSoon',
      count: c.pagesScheduledSoon,
      label: plural(
        c.pagesScheduledSoon,
        '1 page going live in the next 48 hours',
        '{n} pages going live in the next 48 hours',
      ),
      hint: 'They publish themselves at the time you chose.',
      href: { pathname: '/admin/pages', query: { status: 'scheduled' } },
      attention: false,
    });
  if (has('pages.edit'))
    tiles.push({
      key: 'pagesStaleDrafts',
      count: c.pagesStaleDrafts,
      label: plural(
        c.pagesStaleDrafts,
        '1 draft not touched for 30 days',
        '{n} drafts not touched for 30 days',
      ),
      hint: 'Finish and publish them, or move them to Trash.',
      href: { pathname: '/admin/pages', query: { status: 'draft' } },
      attention: false,
    });
  if (has('media.edit'))
    tiles.push({
      key: 'mediaMissingAlt',
      count: c.mediaMissingAlt,
      label: plural(
        c.mediaMissingAlt,
        '1 photo needs a description',
        '{n} photos need a description',
      ),
      hint: 'Photos can’t go on the website until they have one.',
      href: { pathname: '/admin/media', query: { filter: 'missing-description' } },
      attention: c.mediaMissingAlt > 0,
    });
  const trash = (has('pages.delete') ? c.trashPages : 0) + (has('media.delete') ? c.trashMedia : 0);
  if (has('pages.delete') || has('media.delete'))
    tiles.push({
      key: 'trash',
      count: trash,
      label: plural(trash, '1 item in Trash', '{n} items in Trash'),
      hint: 'Items can be restored for 30 days.',
      href: { pathname: '/admin/trash' },
      attention: false,
    });
  return tiles;
}
