/**
 * The shared content lifecycle (MP §5, spec §2.3), mirrored in TypeScript only to decide which
 * buttons to show. The database trigger `private.content_lifecycle_guard` is the authority; a unit
 * test checks this mirror against the same table pgTAP `30_lifecycle.sql` uses. Client-safe.
 */

export const CONTENT_STATUSES = [
  'draft',
  'in_review',
  'scheduled',
  'published',
  'archived',
] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

/** Module-level permission actions (`<module>.<action>`). */
export type ModuleAction = 'view' | 'create' | 'edit' | 'publish' | 'approve' | 'delete';

/** What publishing needs: `approve` when the school's approval workflow is on (Q4, P4-A). */
export const publishAction = (approval: boolean): ModuleAction =>
  approval ? 'approve' : 'publish';

/**
 * The permission a status change needs, or null when the change is not allowed at all.
 * Mirrors the trigger: in_review needs the approval workflow; sending back needs approve; any other
 * change goes through the publish gate.
 */
export function transitionPermission(
  from: ContentStatus,
  to: ContentStatus,
  approval: boolean,
): ModuleAction | null {
  if (from === to) return null;
  if (to === 'in_review') return approval ? 'edit' : null;
  if (from === 'in_review' && to === 'draft') return 'approve';
  return publishAction(approval);
}

/** Changing the content of an item that is (or will be) public is a publish action (spec §2.3). */
export function contentEditPermission(status: ContentStatus, approval: boolean): ModuleAction {
  return status === 'published' || status === 'scheduled' ? publishAction(approval) : 'edit';
}

/** The buttons an editor can offer. Labels live in the UI; plain language (MP §11). */
export type EditorAction =
  | 'saveDraft' // apply your changes; status unchanged (draft, in review, archived)
  | 'submitForReview' // draft → in_review (approval on, for people who can't publish)
  | 'sendBack' // in_review → draft, with a note (approve)
  | 'publish' // → published now
  | 'schedule' // → scheduled, or change the time of a scheduled item
  | 'publishChanges' // published: apply your changes to the live item
  | 'saveScheduled' // scheduled: apply your changes, keep the schedule
  | 'unpublish' // published → draft ("Hide from website")
  | 'cancelSchedule' // scheduled → draft
  | 'trash'
  | 'restore'
  | 'purge';

export interface EditorContext {
  status: ContentStatus;
  deleted: boolean;
  approval: boolean;
  /** Does the person hold `<module>.<action>`? */
  can: (action: ModuleAction) => boolean;
  /** `trash.purge` */
  canPurge: boolean;
}

export function editorActions(ctx: EditorContext): EditorAction[] {
  const { status, approval, can } = ctx;
  if (ctx.deleted) {
    const actions: EditorAction[] = [];
    if (can('delete')) actions.push('restore');
    if (ctx.canPurge) actions.push('purge');
    return actions;
  }
  const canPublish = can(publishAction(approval));
  const actions: EditorAction[] = [];
  switch (status) {
    case 'draft':
    case 'archived':
      if (can('edit')) actions.push('saveDraft');
      if (status === 'draft' && approval && can('edit') && !canPublish)
        actions.push('submitForReview');
      if (canPublish) actions.push('publish', 'schedule');
      break;
    case 'in_review':
      if (can('edit')) actions.push('saveDraft');
      if (can('approve')) actions.push('publish', 'schedule', 'sendBack');
      break;
    case 'scheduled':
      if (canPublish) actions.push('saveScheduled', 'publish', 'schedule', 'cancelSchedule');
      break;
    case 'published':
      if (canPublish) actions.push('publishChanges', 'unpublish');
      break;
  }
  if (can('delete')) actions.push('trash');
  return actions;
}

/** Whether the person may change the content at all (otherwise the editor opens read-only). */
export function canEditContent(ctx: EditorContext): boolean {
  if (ctx.deleted) return false;
  return ctx.can(contentEditPermission(ctx.status, ctx.approval));
}

/** Audit action names (`<module>.<verb>`); the review note RPC reads `.send_back` and `.submit`. */
export const AUDIT_VERB: Record<EditorAction, string> = {
  saveDraft: 'update',
  submitForReview: 'submit',
  sendBack: 'send_back',
  publish: 'publish',
  schedule: 'schedule',
  publishChanges: 'publish',
  saveScheduled: 'update',
  unpublish: 'unpublish',
  cancelSchedule: 'unschedule',
  trash: 'trash',
  restore: 'restore',
  purge: 'purge',
};
