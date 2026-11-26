import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createStaffUser, signedInClient } from '../../../../test/support/supabase';
import { actAs } from '../../../../test/support/actions';

vi.mock('@/lib/supabase/server', async (orig) =>
  (await import('../../../../test/support/actions')).serverMock(orig),
);
vi.mock('next/cache', async () => (await import('../../../../test/support/actions')).cacheMock());

const pages = await import('@/features/pages/actions');
const media = await import('@/features/media/actions');

/**
 * Spec §8.4: every action refuses a signed-out caller, refuses someone without the permission, and
 * refuses invalid input. Happy paths, audit rows and CONFLICT are covered per flow in
 * pages.int.test.ts and media.int.test.ts. The completeness test fails if an action is added
 * without a row here.
 */
type Action = (raw: unknown) => Promise<{ ok: boolean; error?: { code: string } }>;

const id = randomUUID();
const doc = { type: 'doc', content: [] };
const values = {
  title: 'Matrix page',
  slug: 'matrix-page',
  parentId: null,
  body: doc,
  excerpt: '',
  layout: 'default',
  showInNav: false,
  coverMediaId: null,
  seo: {},
};

const MATRIX: Record<string, { action: Action; valid: unknown; invalid?: unknown }> = {
  createPage: { action: pages.createPage, valid: { title: 'Matrix page', parentId: null } },
  autosavePage: { action: pages.autosavePage, valid: { id, baseVersion: 1, data: { title: 'x' } } },
  savePage: { action: pages.savePage, valid: { id, version: 1, values } },
  publishPage: { action: pages.publishPage, valid: { id, version: 1, values } },
  schedulePage: {
    action: pages.schedulePage,
    valid: { id, version: 1, values, publishAt: new Date(Date.now() + 86_400_000).toISOString() },
  },
  submitPageForReview: { action: pages.submitPageForReview, valid: { id, version: 1, values } },
  sendPageBack: { action: pages.sendPageBack, valid: { id, version: 1, note: 'Please check.' } },
  unpublishPage: { action: pages.unpublishPage, valid: { id, version: 1 } },
  trashPage: { action: pages.trashPage, valid: { id, version: 1 } },
  restorePage: { action: pages.restorePage, valid: { id } },
  purgePage: { action: pages.purgePage, valid: { id, confirmTitle: 'x' } },
  discardPageChanges: { action: pages.discardPageChanges, valid: { id } },
  pageEditorStatus: { action: pages.pageEditorStatus, valid: { id } },
  movePage: { action: pages.movePage, valid: { id, version: 1, parentId: null } },
  reorderPages: { action: pages.reorderPages, valid: { parentId: null, ids: [id] } },
  createPagePreview: { action: pages.createPagePreview, valid: { id } },
  requestMediaUpload: {
    action: media.requestMediaUpload,
    valid: { filename: 'a.jpg', mime: 'image/jpeg', size: 1000 },
  },
  confirmMediaUpload: { action: media.confirmMediaUpload, valid: { assetId: id } },
  updateMedia: { action: media.updateMedia, valid: { id, version: 1, altText: 'A', caption: '' } },
  requestMediaReplace: {
    action: media.requestMediaReplace,
    valid: { id, filename: 'a.jpg', mime: 'image/jpeg', size: 1000 },
  },
  confirmMediaReplace: {
    action: media.confirmMediaReplace,
    valid: { id, version: 1, path: `${id}/${randomUUID()}.jpg`, filename: 'a.jpg' },
  },
  trashMedia: { action: media.trashMedia, valid: { id, version: 1 } },
  restoreMedia: { action: media.restoreMedia, valid: { id } },
  purgeMedia: { action: media.purgeMedia, valid: { id, confirmTitle: 'x' } },
  // Every field is optional, so the generic invalid input would be valid here.
  searchMedia: { action: media.searchMedia, valid: { page: 1 }, invalid: { page: 0 } },
  mediaUsages: { action: media.mediaUsages, valid: { id } },
};

let noRoles: Awaited<ReturnType<typeof signedInClient>>;
beforeAll(async () => {
  noRoles = await signedInClient(await createStaffUser(null, { name: 'No roles' }));
});

describe('action matrix (spec §8.4)', () => {
  it('lists every exported page and media action', () => {
    const exported = [...Object.keys(pages), ...Object.keys(media)].sort();
    expect(Object.keys(MATRIX).sort()).toEqual(exported);
  });

  it.each(Object.entries(MATRIX))(
    '%s refuses a signed-out caller',
    async (_name, { action, valid }) => {
      actAs(null);
      expect((await action(valid)).error?.code).toBe('UNAUTHENTICATED');
    },
  );

  it.each(Object.entries(MATRIX))(
    '%s refuses staff without the permission',
    async (_name, { action, valid }) => {
      actAs(noRoles);
      expect((await action(valid)).error?.code).toBe('FORBIDDEN');
    },
  );

  it.each(Object.entries(MATRIX))(
    '%s refuses invalid input before anything else',
    async (_name, { action, invalid }) => {
      actAs(noRoles);
      expect((await action(invalid ?? { id: 'not-a-uuid', version: -1 })).error?.code).toBe(
        'VALIDATION',
      );
    },
  );
});
