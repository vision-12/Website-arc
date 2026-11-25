import { describe, expect, it } from 'vitest';
import {
  canEditContent,
  contentEditPermission,
  editorActions,
  transitionPermission,
  type ContentStatus,
  type EditorContext,
  type ModuleAction,
} from '../lifecycle';

/**
 * Spec §2.3, row by row — the same rules private.content_lifecycle_guard enforces and pgTAP
 * 30_lifecycle.sql / 36_pages_tree.sql exercise. If this table changes, the trigger must too.
 */
const TRANSITIONS: Array<[ContentStatus, ContentStatus, boolean, ModuleAction | null]> = [
  // [from, to, approval on?, permission needed]
  ['draft', 'in_review', false, null], // review needs the approval workflow
  ['draft', 'in_review', true, 'edit'],
  ['in_review', 'draft', true, 'approve'], // "Send back"
  ['draft', 'published', false, 'publish'],
  ['draft', 'published', true, 'approve'],
  ['draft', 'scheduled', false, 'publish'],
  ['in_review', 'published', true, 'approve'],
  ['in_review', 'scheduled', true, 'approve'],
  ['published', 'draft', false, 'publish'], // "Hide from website"
  ['published', 'draft', true, 'approve'],
  ['scheduled', 'draft', false, 'publish'], // "Cancel schedule"
  ['scheduled', 'draft', true, 'approve'],
  ['scheduled', 'published', false, 'publish'],
  ['published', 'archived', false, 'publish'],
  ['archived', 'published', true, 'approve'],
];

describe('transitionPermission mirrors spec §2.3', () => {
  it.each(TRANSITIONS)('%s → %s (approval %s) needs %s', (from, to, approval, expected) => {
    expect(transitionPermission(from, to, approval)).toBe(expected);
  });

  it('is not a transition when the status stays the same', () => {
    expect(transitionPermission('draft', 'draft', false)).toBeNull();
  });
});

describe('contentEditPermission', () => {
  it('editing what the public sees (or will see) is a publish action', () => {
    expect(contentEditPermission('draft', false)).toBe('edit');
    expect(contentEditPermission('in_review', true)).toBe('edit');
    expect(contentEditPermission('published', false)).toBe('publish');
    expect(contentEditPermission('scheduled', false)).toBe('publish');
    expect(contentEditPermission('published', true)).toBe('approve');
  });
});

const ctx = (
  status: ContentStatus,
  perms: ModuleAction[],
  opts: Partial<EditorContext> = {},
): EditorContext => ({
  status,
  deleted: false,
  approval: false,
  canPurge: false,
  can: (a) => perms.includes(a),
  ...opts,
});

describe('editorActions: which buttons each person sees', () => {
  const editor: ModuleAction[] = ['view', 'create', 'edit', 'publish', 'delete'];
  const headteacher: ModuleAction[] = ['view', 'approve', 'publish'];

  it('content editor, approval off: draft can be saved, published, scheduled or trashed', () => {
    expect(editorActions(ctx('draft', editor))).toEqual([
      'saveDraft',
      'publish',
      'schedule',
      'trash',
    ]);
  });

  it('content editor, approval on: can only submit for review', () => {
    expect(editorActions(ctx('draft', editor, { approval: true }))).toEqual([
      'saveDraft',
      'submitForReview',
      'trash',
    ]);
    expect(editorActions(ctx('published', editor, { approval: true }))).toEqual(['trash']);
  });

  it('headteacher, approval on: approves, schedules or sends back an item in review', () => {
    expect(editorActions(ctx('in_review', headteacher, { approval: true }))).toEqual([
      'publish',
      'schedule',
      'sendBack',
    ]);
  });

  it('live and scheduled items offer the matching actions', () => {
    expect(editorActions(ctx('published', editor))).toEqual([
      'publishChanges',
      'unpublish',
      'trash',
    ]);
    expect(editorActions(ctx('scheduled', editor))).toEqual([
      'saveScheduled',
      'publish',
      'schedule',
      'cancelSchedule',
      'trash',
    ]);
  });

  it('read-only staff see no actions and cannot edit', () => {
    const readOnly = ctx('published', ['view']);
    expect(editorActions(readOnly)).toEqual([]);
    expect(canEditContent(readOnly)).toBe(false);
  });

  it('trashed items offer restore, and permanent delete only with trash.purge', () => {
    expect(editorActions(ctx('published', editor, { deleted: true }))).toEqual(['restore']);
    expect(editorActions(ctx('draft', editor, { deleted: true, canPurge: true }))).toEqual([
      'restore',
      'purge',
    ]);
    expect(canEditContent(ctx('draft', editor, { deleted: true }))).toBe(false);
  });
});
