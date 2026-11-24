import 'server-only';
import type { TypedClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';
import { redact } from './redact';

export interface AuditEntry {
  action: string;
  entityType?: string;
  entityId?: string;
  summary: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  ipHash?: string;
}

/** Writes an audit entry as the signed-in user via log_activity() (actor cannot be spoofed). */
export async function logActivity(supabase: TypedClient, entry: AuditEntry): Promise<void> {
  const diff =
    entry.before !== undefined || entry.after !== undefined
      ? (redact({ before: entry.before ?? null, after: entry.after ?? null }) as Json)
      : null;
  const { error } = await supabase.rpc('log_activity', {
    p_action: entry.action,
    p_summary: entry.summary,
    ...(entry.entityType ? { p_entity_type: entry.entityType } : {}),
    ...(entry.entityId ? { p_entity_id: entry.entityId } : {}),
    ...(diff ? { p_diff: diff } : {}),
    ...(entry.metadata ? { p_metadata: redact(entry.metadata) as Json } : {}),
    ...(entry.ipHash ? { p_ip_hash: entry.ipHash } : {}),
  });
  if (error) throw error;
}
