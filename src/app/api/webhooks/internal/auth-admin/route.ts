import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { publicEnv } from '@/lib/env/public';
import { hasCronSecret } from '@/lib/security/cron-auth';

/**
 * Privileged auth operations (spec D13, ADR-007). NOT called by browsers: a Server Action first
 * creates an auth_admin_jobs row through RLS (users.manage + escalation check in SQL), then calls
 * this route server-to-server with CRON_SECRET. The route re-validates the job before touching
 * auth.admin, so a leaked secret alone cannot invite or sign anyone out.
 */
const Body = z.object({ jobId: z.uuid() });
const MAX_AGE_MS = 60_000;

const InvitePayload = z.object({
  email: z.email(),
  full_name: z.string().min(2).max(120),
  role_ids: z.array(z.uuid()).min(1).max(10),
});

export async function POST(request: NextRequest) {
  if (!hasCronSecret(request)) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const admin = createAdminClient();
  const { data: job } = await admin
    .from('auth_admin_jobs')
    .select('*')
    .eq('id', parsed.data.jobId)
    .maybeSingle();
  if (!job || job.state !== 'pending')
    return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const fail = async (error: string, status = 422) => {
    await admin
      .from('auth_admin_jobs')
      .update({ state: 'failed', error, completed_at: new Date().toISOString() })
      .eq('id', job.id);
    return NextResponse.json({ error }, { status });
  };

  if (Date.now() - new Date(job.created_at).getTime() > MAX_AGE_MS) return fail('expired', 410);
  if (!job.requested_by) return fail('no_requester', 403);
  const { data: stillAllowed } = await admin.rpc('user_has_permission', {
    p_user: job.requested_by,
    p: 'users.manage',
  });
  if (!stillAllowed) return fail('requester_no_longer_permitted', 403);

  const { data: requester } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', job.requested_by)
    .maybeSingle();
  const audit = (
    action: string,
    summary: string,
    entityId: string | null,
    metadata: Record<string, unknown>,
  ) =>
    admin.from('activity_logs').insert({
      source: 'app',
      actor_id: job.requested_by,
      actor_label: requester?.full_name ?? null,
      action,
      entity_type: 'profile',
      entity_id: entityId,
      summary,
      metadata: metadata as never,
    });

  if (job.op === 'invite') {
    const payload = InvitePayload.safeParse(job.payload);
    if (!payload.success) return fail('invalid_payload', 400);
    const { data, error } = await admin.auth.admin.inviteUserByEmail(payload.data.email, {
      data: { full_name: payload.data.full_name },
      redirectTo: new URL('/accept-invite', publicEnv.NEXT_PUBLIC_SITE_URL).toString(),
    });
    if (error) return fail(error.code ?? 'invite_failed');
    const userId = data.user.id;
    // System context (service role): the escalation check already ran when the job was created.
    const { error: roleError } = await admin.from('user_roles').insert(
      payload.data.role_ids.map((role_id) => ({
        user_id: userId,
        role_id,
        granted_by: job.requested_by,
      })),
    );
    if (roleError) return fail('role_assignment_failed', 500);
    await admin
      .from('auth_admin_jobs')
      .update({ state: 'done', target_user_id: userId, completed_at: new Date().toISOString() })
      .eq('id', job.id);
    await audit('users.invite', 'Invited a new staff member', userId, {
      roles: payload.data.role_ids.length,
    });
    return NextResponse.json({ ok: true, userId });
  }

  if (job.op === 'sign_out') {
    if (!job.target_user_id) return fail('no_target', 400);
    const { data: revoked, error } = await admin.rpc('revoke_user_sessions', {
      p_user: job.target_user_id,
    });
    if (error) return fail('revoke_failed', 500);
    await admin
      .from('auth_admin_jobs')
      .update({ state: 'done', completed_at: new Date().toISOString() })
      .eq('id', job.id);
    await audit('users.sessions_revoked', 'Signed a user out of all devices', job.target_user_id, {
      sessions: revoked,
    });
    return NextResponse.json({ ok: true, sessions: revoked });
  }

  // resend_invite is implemented with the users screen (Phase 13).
  return fail('unsupported_operation', 400);
}
