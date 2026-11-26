import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { z } from '@/lib/zod';
import { publishAction, type EditorContext, type ModuleAction } from '@/features/content/lifecycle';
import type { Access } from '@/lib/auth/access';

const Features = z.object({
  features: z.object({ contentApproval: z.boolean().optional() }).optional(),
});

/**
 * Whether the school's approval workflow is on (Q4, P4-A). Read live, not from the cached settings:
 * the database trigger enforces the live value, and the buttons and permission checks must agree
 * with it the moment the setting changes. Admin pages and actions are request-time anyway.
 */
export async function approvalOn(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from('site_settings').select('data').eq('id', 1).maybeSingle();
  const parsed = Features.safeParse(data?.data);
  return parsed.success && parsed.data.features?.contentApproval === true;
}

/** The permission publishing, scheduling and hiding need right now (spec §2.3). */
export async function pagePublishPermission(): Promise<string> {
  return `pages.${publishAction(await approvalOn())}`;
}

/** Built-in pages can be edited and hidden, but never moved to Trash (spec §1.4; DB-enforced). */
export function withoutTrashForBuiltIn<T extends string>(
  actions: T[],
  systemKey: string | null,
): T[] {
  return systemKey ? actions.filter((a) => a !== 'trash') : actions;
}

/** The lifecycle context for the editor's buttons. The server re-checks every action. */
export function pageEditorContext(
  access: Access,
  row: { status: EditorContext['status']; deleted_at: string | null },
  approval: boolean,
): EditorContext {
  return {
    status: row.status,
    deleted: row.deleted_at !== null,
    approval,
    can: (action: ModuleAction) => access.permissions.has(`pages.${action}`),
    canPurge: access.permissions.has('trash.purge'),
  };
}
