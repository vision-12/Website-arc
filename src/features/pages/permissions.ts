import 'server-only';
import { getSiteSettings } from '@/features/cms/settings/queries';
import { publishAction, type EditorContext, type ModuleAction } from '@/features/content/lifecycle';
import type { Access } from '@/lib/auth/access';

/** Whether the school's approval workflow is on (Q4, P4-A). */
export async function approvalOn(): Promise<boolean> {
  const { settings } = await getSiteSettings();
  return settings.features.contentApproval;
}

/** The permission publishing, scheduling and hiding need right now (spec §2.3). */
export async function pagePublishPermission(): Promise<string> {
  return `pages.${publishAction(await approvalOn())}`;
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
