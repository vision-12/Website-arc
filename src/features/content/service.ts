import 'server-only';
import { updateTag } from 'next/cache';
import type { z } from 'zod';
import type { Access } from '@/lib/auth/access';
import { ActionFailure } from '@/lib/actions/errors';
import { logActivity } from '@/lib/audit/log';
import { CacheTags } from '@/lib/cache/tags';
import { createClient, type TypedClient } from '@/lib/supabase/server';
import { asJson } from '@/lib/supabase/json';
import { AUDIT_VERB, type ContentStatus, type EditorAction } from './lifecycle';
import type { OtherEditor, ReviewNote } from './schema';

/**
 * The shared content service (spec §4.1 `createContentActions`, D3, D4; plan P4-D). Every content
 * module (pages now; news, events, … later) gets working copies, version-checked saves, conflict
 * handling, status changes, Trash and audit from here, through a small typed table adapter. The
 * database trigger remains the authority on who may do what (spec §2.3); this layer only turns its
 * answers into plain-language results.
 */

export type ContentModuleKey = 'pages';

/** Work in progress: any subset of the values (exactOptionalPropertyTypes-friendly Partial). */
export type DraftOf<V> = { [K in keyof V]?: V[K] | undefined };

export interface ContentRowBase {
  id: string;
  version: number;
  status: ContentStatus;
  publish_at: string | null;
  published_at: string | null;
  deleted_at: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface LifecyclePatch {
  status?: ContentStatus;
  publish_at?: string | null;
  deleted_at?: string | null;
}

/** Typed queries for one table, written by the module (PostgREST types need a literal table). */
export interface ContentTableAdapter<Row extends ContentRowBase, Patch> {
  get(supabase: TypedClient, id: string): Promise<Row | null>;
  /** Version-checked update of a row that is not in Trash; null when nothing matched. */
  update(
    supabase: TypedClient,
    id: string,
    version: number,
    patch: Patch & LifecyclePatch,
  ): Promise<Row | null>;
  /** Update of a trashed row, without a version check (restore). */
  restore(
    supabase: TypedClient,
    id: string,
    patch: Partial<Patch> & LifecyclePatch,
  ): Promise<Row | null>;
  remove(supabase: TypedClient, id: string): Promise<void>;
}

export interface ContentModule<V, Row extends ContentRowBase, Patch> {
  module: ContentModuleKey;
  table: ContentTableAdapter<Row, Patch>;
  /** Lenient schema for work in progress (autosave). */
  draftValues: z.ZodType<DraftOf<V>>;
  toPatch(values: V): Patch;
  fromRow(row: Row): V;
  titleOf(row: Row): string;
  /** Compact, non-sensitive view of a row for the audit diff (bodies are redacted anyway). */
  auditView(row: Row): Record<string, unknown>;
  /** Cache tags a change to this row may affect on the public site. */
  publicTags(row: Row): string[];
  /** A plain-language failure for a module-specific write error (e.g. address taken), or null. */
  writeError?(error: unknown): ActionFailure | null;
  /** A patch that frees the row's address when restoring collides with a live item. */
  renameOnRestore?(row: Row): Partial<Patch> | null;
}

export interface WorkingCopy<V> {
  values: DraftOf<V>;
  baseVersion: number;
  savedAt: string;
  /** Someone else changed the item after this copy was started. */
  stale: boolean;
}

export interface EditorState<V, Row> {
  row: Row;
  values: V;
  copy: WorkingCopy<V> | null;
  editors: OtherEditor[];
  reviewNote: ReviewNote | null;
  lastEditedBy: string | null;
}

export interface AutosaveResult {
  /** null: skipped because the previous save was under 5 seconds ago (retry later). */
  savedAt: string | null;
  version: number;
  stale: boolean;
  editors: OtherEditor[];
}

/** What a write does: the audit verb, and optionally a new status and publish time. */
export interface Transition {
  action: EditorAction;
  status?: ContentStatus;
  publishAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface WriteResult {
  id: string;
  version: number;
  status: ContentStatus;
  publishAt: string | null;
}

const SUMMARY: Record<EditorAction, string> = {
  saveDraft: 'Saved changes to',
  submitForReview: 'Submitted for approval:',
  sendBack: 'Sent back for changes:',
  publish: 'Published',
  schedule: 'Scheduled',
  publishChanges: 'Published changes to',
  saveScheduled: 'Saved changes to',
  unpublish: 'Hid from the website:',
  cancelSchedule: 'Cancelled the schedule of',
  trash: 'Moved to Trash:',
  restore: 'Restored',
  purge: 'Permanently deleted',
};

const isPublic = (row: ContentRowBase) => row.status === 'published' && row.deleted_at === null;
const normaliseTitle = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23505'
  );
}

export function contentService<V, Row extends ContentRowBase, Patch>(
  m: ContentModule<V, Row, Patch>,
) {
  const entity = m.module;

  async function otherEditors(supabase: TypedClient, id: string): Promise<OtherEditor[]> {
    const { data, error } = await supabase.rpc('content_editors', {
      p_entity_type: entity,
      p_entity_id: id,
    });
    if (error) throw error;
    return data.map((e) => ({ name: e.full_name, updatedAt: e.updated_at }));
  }

  async function nameOf(supabase: TypedClient, userId: string | null): Promise<string | null> {
    if (!userId) return null;
    const { data } = await supabase.rpc('staff_names', { p_ids: [userId] });
    return data?.[0]?.full_name ?? null;
  }

  /** Keeps the person's text after a failed save: nothing typed is ever lost (P4-D). */
  async function keepCopy(
    supabase: TypedClient,
    access: Access,
    id: string,
    base: number,
    values: V,
  ) {
    await supabase.from('content_drafts').upsert(
      {
        entity_type: entity,
        entity_id: id,
        updated_by: access.userId,
        data: asJson(values as object),
        base_version: base,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'entity_type,entity_id,updated_by' },
    );
  }

  async function dropCopy(supabase: TypedClient, access: Access, id: string) {
    const { error } = await supabase
      .from('content_drafts')
      .delete()
      .eq('entity_type', entity)
      .eq('entity_id', id)
      .eq('updated_by', access.userId);
    if (error) throw error;
  }

  /** Read-your-writes for the acting editor; visitors get fresh pages on their next request. */
  function expireTags(before: Row | null, after: Row | null) {
    const tags = new Set<string>();
    if (before && isPublic(before)) for (const t of m.publicTags(before)) tags.add(t);
    if (after && isPublic(after)) for (const t of m.publicTags(after)) tags.add(t);
    if (tags.size === 0) return;
    tags.add(CacheTags.sitemap);
    for (const tag of tags) updateTag(tag);
  }

  async function audit(
    supabase: TypedClient,
    action: EditorAction,
    before: Row | null,
    after: Row | null,
    metadata?: Record<string, unknown>,
  ) {
    const row = after ?? before;
    const meta = metadata && Object.keys(metadata).length > 0 ? metadata : undefined;
    if (!row) return;
    await logActivity(supabase, {
      action: `${entity}.${AUDIT_VERB[action]}`,
      entityType: entity,
      entityId: row.id,
      summary: `${SUMMARY[action]} "${m.titleOf(row)}"`,
      ...(before ? { before: m.auditView(before) } : {}),
      ...(after ? { after: m.auditView(after) } : {}),
      ...(meta ? { metadata: meta } : {}),
    });
  }

  async function writeOrConflict(
    supabase: TypedClient,
    id: string,
    version: number,
    patch: Patch & LifecyclePatch,
  ): Promise<Row> {
    let after: Row | null;
    try {
      after = await m.table.update(supabase, id, version, patch);
    } catch (error) {
      throw m.writeError?.(error) ?? error;
    }
    if (after) return after;
    const current = await m.table.get(supabase, id);
    if (!current || current.deleted_at) throw new ActionFailure('NOT_FOUND');
    throw new ActionFailure('CONFLICT');
  }

  const result = (row: Row): WriteResult => ({
    id: row.id,
    version: row.version,
    status: row.status,
    publishAt: row.publish_at,
  });

  return {
    /** Everything the editor screen needs, in parallel. Null when the item doesn't exist. */
    async loadEditor(id: string, access: Access): Promise<EditorState<V, Row> | null> {
      const supabase = await createClient();
      const row = await m.table.get(supabase, id);
      if (!row) return null;
      const [copyRes, editors, noteRes, lastEditedBy] = await Promise.all([
        supabase
          .from('content_drafts')
          .select('data, base_version, updated_at')
          .eq('entity_type', entity)
          .eq('entity_id', id)
          .eq('updated_by', access.userId)
          .maybeSingle(),
        otherEditors(supabase, id),
        supabase.rpc('latest_review_note', { p_entity_type: entity, p_entity_id: id }),
        nameOf(supabase, row.updated_by),
      ]);
      let copy: WorkingCopy<V> | null = null;
      if (copyRes.data) {
        const parsed = m.draftValues.safeParse(copyRes.data.data);
        if (parsed.success)
          copy = {
            values: parsed.data,
            baseVersion: copyRes.data.base_version,
            savedAt: copyRes.data.updated_at,
            stale: copyRes.data.base_version !== row.version,
          };
      }
      const note = noteRes.data?.[0];
      return {
        row,
        values: m.fromRow(row),
        copy,
        editors,
        reviewNote: note
          ? { note: note.note, author: note.author, createdAt: note.created_at }
          : null,
        lastEditedBy,
      };
    },

    /** Autosave to the person's working copy (D4); never touches the live item. */
    async autosave(input: {
      id: string;
      baseVersion: number;
      data: DraftOf<V>;
    }): Promise<AutosaveResult> {
      const supabase = await createClient();
      const [saved, row, editors] = await Promise.all([
        supabase.rpc('save_working_copy', {
          p_entity_type: entity,
          p_entity_id: input.id,
          p_base_version: input.baseVersion,
          p_data: asJson(input.data),
        }),
        m.table.get(supabase, input.id),
        otherEditors(supabase, input.id),
      ]);
      if (saved.error) throw saved.error;
      if (!row || row.deleted_at) throw new ActionFailure('NOT_FOUND');
      return {
        // The generated type says string; the function returns null when the save was throttled.
        savedAt: saved.data,
        version: row.version,
        stale: row.version !== input.baseVersion,
        editors,
      };
    },

    /**
     * Applies the person's values to the item, optionally changing its status, in one
     * version-checked update. On a conflict the values are kept as their working copy.
     */
    async apply(
      input: { id: string; version: number; values: V },
      access: Access,
      decide: (before: Row) => Transition,
    ): Promise<WriteResult> {
      const supabase = await createClient();
      const before = await m.table.get(supabase, input.id);
      if (!before || before.deleted_at) throw new ActionFailure('NOT_FOUND');
      const t = decide(before);
      const patch: Patch & LifecyclePatch = {
        ...m.toPatch(input.values),
        ...(t.status ? { status: t.status } : {}),
        ...(t.publishAt !== undefined ? { publish_at: t.publishAt } : {}),
      };
      let after: Row;
      try {
        if (before.version !== input.version) throw new ActionFailure('CONFLICT');
        after = await writeOrConflict(supabase, input.id, input.version, patch);
      } catch (error) {
        if (error instanceof ActionFailure && error.code === 'CONFLICT')
          await keepCopy(supabase, access, input.id, input.version, input.values);
        throw error;
      }
      await dropCopy(supabase, access, input.id);
      await audit(supabase, t.action, before, after, {
        ...(after.status === 'scheduled' ? { publishAt: after.publish_at } : {}),
        ...t.metadata,
      });
      expireTags(before, after);
      return result(after);
    },

    /** A status change without content changes (hide, cancel schedule, send back). */
    async changeStatus(
      input: { id: string; version: number },
      decide: (before: Row) => Transition & { status: ContentStatus },
    ): Promise<WriteResult> {
      const supabase = await createClient();
      const before = await m.table.get(supabase, input.id);
      if (!before || before.deleted_at) throw new ActionFailure('NOT_FOUND');
      if (before.version !== input.version) throw new ActionFailure('CONFLICT');
      const t = decide(before);
      const after = await writeOrConflict(supabase, input.id, input.version, {
        status: t.status,
        ...(t.publishAt !== undefined ? { publish_at: t.publishAt } : {}),
      } as Patch & LifecyclePatch);
      await audit(supabase, t.action, before, after, t.metadata);
      expireTags(before, after);
      return result(after);
    },

    async trash(input: { id: string; version: number }): Promise<WriteResult> {
      const supabase = await createClient();
      const before = await m.table.get(supabase, input.id);
      if (!before || before.deleted_at) throw new ActionFailure('NOT_FOUND');
      if (before.version !== input.version) throw new ActionFailure('CONFLICT');
      const after = await writeOrConflict(supabase, input.id, input.version, {
        deleted_at: new Date().toISOString(),
      } as Patch & LifecyclePatch);
      await audit(supabase, 'trash', before, after);
      expireTags(before, after);
      return result(after);
    },

    /** Brings an item back from Trash with the status it had. A taken address gets a new one. */
    async restore(input: { id: string }): Promise<WriteResult & { renamed: boolean }> {
      const supabase = await createClient();
      const before = await m.table.get(supabase, input.id);
      if (!before) throw new ActionFailure('NOT_FOUND');
      if (!before.deleted_at) return { ...result(before), renamed: false };
      let rename: Partial<Patch> = {};
      for (let attempt = 0; attempt < 6; attempt++) {
        try {
          const after = await m.table.restore(supabase, input.id, { ...rename, deleted_at: null });
          if (!after) throw new ActionFailure('NOT_FOUND');
          const renamed = attempt > 0;
          await audit(supabase, 'restore', before, after, renamed ? { renamed: true } : undefined);
          expireTags(before, after);
          return { ...result(after), renamed };
        } catch (error) {
          // The address is taken by a live item: try the module's next free address.
          const next = isUniqueViolation(error)
            ? m.renameOnRestore?.({ ...before, ...rename })
            : null;
          if (!next) throw m.writeError?.(error) ?? error;
          rename = next;
        }
      }
      throw new ActionFailure(
        'VALIDATION',
        'Another item uses this address. Change the other item’s address, then restore this one.',
      );
    },

    /** Permanent delete from Trash; the person types the title to confirm (spec §4.1). */
    async purge(input: { id: string; confirmTitle: string }): Promise<{ id: string }> {
      const supabase = await createClient();
      const before = await m.table.get(supabase, input.id);
      if (!before) throw new ActionFailure('NOT_FOUND');
      if (!before.deleted_at)
        throw new ActionFailure('VALIDATION', 'Only items in Trash can be deleted permanently.');
      if (normaliseTitle(input.confirmTitle) !== normaliseTitle(m.titleOf(before)))
        throw new ActionFailure('VALIDATION', 'Type the title exactly as shown to confirm.', {
          confirmTitle: ['Type the title exactly as shown to confirm.'],
        });
      try {
        await m.table.remove(supabase, input.id);
      } catch (error) {
        throw m.writeError?.(error) ?? error;
      }
      await audit(supabase, 'purge', before, null);
      return { id: input.id };
    },

    /** Throws away the person's unsaved changes. */
    async discard(input: { id: string }, access: Access): Promise<{ id: string }> {
      const supabase = await createClient();
      await dropCopy(supabase, access, input.id);
      return { id: input.id };
    },

    /** What changed while the editor was open (polled): version and who else is editing. */
    async status(input: {
      id: string;
    }): Promise<{ version: number; status: ContentStatus; editors: OtherEditor[] }> {
      const supabase = await createClient();
      const [row, editors] = await Promise.all([
        m.table.get(supabase, input.id),
        otherEditors(supabase, input.id),
      ]);
      if (!row || row.deleted_at) throw new ActionFailure('NOT_FOUND');
      return { version: row.version, status: row.status, editors };
    },
  };
}
