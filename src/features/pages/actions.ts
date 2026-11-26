'use server';
import 'server-only';
import { updateTag } from 'next/cache';
import { defineAction } from '@/lib/actions/define';
import { ActionFailure } from '@/lib/actions/errors';
import { logActivity } from '@/lib/audit/log';
import { CacheTags } from '@/lib/cache/tags';
import { serverEnv } from '@/lib/env/server';
import { createClient } from '@/lib/supabase/server';
import { signDraftToken } from '@/features/content/draft-token';
import { ItemRef, PurgeInput, VersionedRef } from '@/features/content/schema';
import { nextSlug, slugify } from '@/features/content/slug';
import { ADDRESS_TAKEN, pagesContent } from './module';
import { approvalOn, pagePublishPermission } from './permissions';
import {
  AutosavePageInput,
  CreatePageInput,
  MovePageInput,
  ReorderPagesInput,
  SavePageInput,
  SchedulePageInput,
  SendPageBackInput,
} from './schema';
import { pagesTable } from './table';

/**
 * Pages actions (spec §4.1): each one goes through defineAction (Zod → requirePermission → handler
 * → Result). The lifecycle trigger re-checks every transition in the database (spec §2.3).
 */

/** Creates a draft page; the editor opens next. A taken or reserved address gets the next free one. */
export const createPage = defineAction({
  input: CreatePageInput,
  permission: 'pages.create',
  handler: async ({ title, parentId }) => {
    const supabase = await createClient();
    let slug = slugify(title) || 'page';
    for (let attempt = 0; attempt < 8; attempt++) {
      const { data, error } = await supabase
        .from('pages')
        .insert({ title, slug, parent_id: parentId })
        .select('id, title, path')
        .single();
      if (!error) {
        await logActivity(supabase, {
          action: 'pages.create',
          entityType: 'pages',
          entityId: data.id,
          summary: `Created the page "${data.title}"`,
          after: { title: data.title, path: data.path },
        });
        return { id: data.id };
      }
      const reserved = error.message === 'VALIDATION' && /reserved/i.test(error.details);
      if (error.code !== '23505' && !reserved) throw error;
      slug = nextSlug(slug);
    }
    throw new ActionFailure('VALIDATION', ADDRESS_TAKEN);
  },
});

/** Autosave every 10 s to the person's own working copy (D4, P4-D). Never changes the website. */
export const autosavePage = defineAction({
  input: AutosavePageInput,
  permission: 'pages.edit',
  handler: (input, { access }) => pagesContent.autosave(input, access),
});

/** "Save draft" (or "Save changes" on a scheduled page): applies the changes, status unchanged. */
export const savePage = defineAction({
  input: SavePageInput,
  permission: 'pages.edit',
  handler: (input, { access }) =>
    pagesContent.apply(input, access, (before) => ({
      action: before.status === 'scheduled' ? 'saveScheduled' : 'saveDraft',
    })),
});

/** "Publish to website" (or "Publish changes" on a live page). */
export const publishPage = defineAction({
  input: SavePageInput,
  permission: () => pagePublishPermission(),
  handler: (input, { access }) =>
    pagesContent.apply(input, access, (before) =>
      before.status === 'published'
        ? { action: 'publishChanges' }
        : { action: 'publish', status: 'published', publishAt: new Date().toISOString() },
    ),
});

/** "Schedule…": the page goes live at a chosen time (the cron job publishes it). */
export const schedulePage = defineAction({
  input: SchedulePageInput,
  permission: () => pagePublishPermission(),
  handler: ({ publishAt, ...input }, { access }) => {
    const at = new Date(publishAt);
    if (at.getTime() <= Date.now()) {
      const message = 'Choose a time in the future.';
      throw new ActionFailure('VALIDATION', message, { publishAt: [message] });
    }
    return pagesContent.apply(input, access, () => ({
      action: 'schedule',
      status: 'scheduled',
      publishAt: at.toISOString(),
    }));
  },
});

/** "Submit for review" when the approval workflow is on (Q4, P4-A). */
export const submitPageForReview = defineAction({
  input: SavePageInput,
  permission: 'pages.edit',
  handler: async (input, { access }) => {
    if (!(await approvalOn()))
      throw new ActionFailure(
        'VALIDATION',
        'Approval is switched off for this website, so you can publish the page yourself.',
      );
    return pagesContent.apply(input, access, () => ({
      action: 'submitForReview',
      status: 'in_review',
    }));
  },
});

/** "Send back" with a note for the author (approval workflow). */
export const sendPageBack = defineAction({
  input: SendPageBackInput,
  permission: 'pages.approve',
  handler: ({ note, ...input }, { access }) =>
    pagesContent.changeStatus(input, access, () => ({
      action: 'sendBack',
      status: 'draft',
      metadata: { note },
    })),
});

/** "Hide from website" on a live page, "Cancel schedule" on a scheduled one. */
export const unpublishPage = defineAction({
  input: VersionedRef,
  permission: () => pagePublishPermission(),
  handler: (input, { access }) =>
    pagesContent.changeStatus(input, access, (before) => ({
      action: before.status === 'scheduled' ? 'cancelSchedule' : 'unpublish',
      status: 'draft',
    })),
});

export const trashPage = defineAction({
  input: VersionedRef,
  permission: 'pages.delete',
  handler: (input, { access }) => pagesContent.trash(input, access),
});

export const restorePage = defineAction({
  input: ItemRef,
  permission: 'pages.delete',
  handler: (input) => pagesContent.restore(input),
});

export const purgePage = defineAction({
  input: PurgeInput,
  permission: 'trash.purge',
  handler: (input) => pagesContent.purge(input),
});

/** "Discard changes": throws away the person's unsaved changes. */
export const discardPageChanges = defineAction({
  input: ItemRef,
  permission: 'pages.edit',
  handler: (input, { access }) => pagesContent.discard(input, access),
});

/** Polled by the open editor: the page's version and who else is editing it. */
export const pageEditorStatus = defineAction({
  input: ItemRef,
  permission: 'pages.edit',
  handler: (input) => pagesContent.status(input),
});

/** "Move into the page above" / "Move out": a new parent, placed last among its new siblings. */
export const movePage = defineAction({
  input: MovePageInput,
  permission: 'pages.edit',
  handler: async ({ id, version, parentId }) => {
    const supabase = await createClient();
    const before = await pagesTable.get(supabase, id);
    if (!before || before.deleted_at) throw new ActionFailure('NOT_FOUND');
    if (before.version !== version) throw new ActionFailure('CONFLICT');
    const siblings = supabase.from('pages').select('nav_order').is('deleted_at', null);
    const { data: rows, error } = await (parentId
      ? siblings.eq('parent_id', parentId)
      : siblings.is('parent_id', null));
    if (error) throw error;
    const navOrder = rows.reduce((max, r) => Math.max(max, r.nav_order), 0) + 10;
    let after;
    try {
      after = await pagesTable.update(supabase, id, version, {
        parent_id: parentId,
        nav_order: navOrder,
      });
    } catch (e) {
      if ((e as { code?: unknown }).code === '23505')
        throw new ActionFailure(
          'VALIDATION',
          'A page with the same address is already there. Change this page’s address first.',
        );
      throw e;
    }
    if (!after) throw new ActionFailure('CONFLICT');
    await logActivity(supabase, {
      action: 'pages.move',
      entityType: 'pages',
      entityId: id,
      summary: `Moved "${after.title}" to ${after.path}`,
      before: { path: before.path, parent_id: before.parent_id },
      after: { path: after.path, parent_id: after.parent_id },
    });
    if (before.status === 'published') {
      for (const tag of [
        CacheTags.pages,
        CacheTags.page(before.path),
        CacheTags.page(after.path),
        CacheTags.redirects,
        CacheTags.sitemap,
      ])
        updateTag(tag);
    }
    return { version: after.version, path: after.path };
  },
});

/** Menu order among siblings ("Move up" / "Move down"), in one statement. */
export const reorderPages = defineAction({
  input: ReorderPagesInput,
  permission: 'pages.edit',
  handler: async ({ parentId, ids }) => {
    const supabase = await createClient();
    const { error } = await supabase.rpc('reorder_pages', {
      p_ids: ids,
      ...(parentId ? { p_parent: parentId } : {}),
    });
    if (error) throw error;
    await logActivity(supabase, {
      action: 'pages.reorder',
      entityType: 'pages',
      ...(parentId ? { entityId: parentId } : {}),
      summary: 'Changed the order of pages in the menu',
      metadata: { ids },
    });
    updateTag(CacheTags.pages);
    updateTag(CacheTags.sitemap);
    return { reordered: ids.length };
  },
});

/** A ten-minute preview link for this page, bound to the person who asked for it. */
export const createPagePreview = defineAction({
  input: ItemRef,
  permission: 'pages.view',
  handler: ({ id }, { access }) => {
    const token = signDraftToken(
      { userId: access.userId, entityType: 'pages', entityId: id },
      serverEnv().PREVIEW_TOKEN_SECRET,
    );
    return Promise.resolve({ url: `/api/draft?token=${encodeURIComponent(token)}` });
  },
});
