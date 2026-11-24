import 'server-only';
import { publicEnv } from '@/lib/env/public';
import { serverEnv } from '@/lib/env/server';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

export type AuthAdminOp = 'invite' | 'sign_out';

/**
 * Queues a privileged auth operation as the signed-in user (RLS + escalation checks run here),
 * then asks the internal route to execute it (spec D13). Used by the Phase 13 users screen.
 */
export async function queueAuthAdminJob(
  op: AuthAdminOp,
  args: { targetUserId?: string; payload?: Json },
) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const requestedBy = claims?.claims.sub;
  if (!requestedBy) throw Object.assign(new Error('UNAUTHENTICATED'), { code: '42501' });

  const { data: job, error } = await supabase
    .from('auth_admin_jobs')
    .insert({
      op,
      requested_by: requestedBy,
      payload: args.payload ?? {},
      ...(args.targetUserId ? { target_user_id: args.targetUserId } : {}),
    })
    .select('id')
    .single();
  if (error) throw error;

  const res = await fetch(
    new URL('/api/webhooks/internal/auth-admin', publicEnv.NEXT_PUBLIC_SITE_URL),
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${serverEnv().CRON_SECRET}`,
      },
      body: JSON.stringify({ jobId: job.id }),
      cache: 'no-store',
    },
  );
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    userId?: string;
  };
  return { ok: res.ok && body.ok === true, error: body.error, userId: body.userId };
}
