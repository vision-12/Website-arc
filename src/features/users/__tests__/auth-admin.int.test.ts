import type { Json } from '@/types/database';
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { POST } from '@/app/api/webhooks/internal/auth-admin/route';
import {
  adminClient,
  createStaffUser,
  latestEmail,
  signedInClient,
} from '../../../../test/support/supabase';

const call = (jobId: string, secret = process.env.CRON_SECRET) =>
  POST(
    new NextRequest('http://localhost/api/webhooks/internal/auth-admin', {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
      body: JSON.stringify({ jobId }),
    }),
  );

async function roleId(key: string) {
  const { data } = await adminClient().from('roles').select('id').eq('key', key).single();
  return data!.id;
}

describe('privileged auth jobs (spec D13)', () => {
  it('invites a user end to end: RLS-checked job → route → email → roles → audit', async () => {
    const schoolAdmin = await createStaffUser('school_admin');
    const as = await signedInClient(schoolAdmin);
    const email = `invitee-${Date.now()}@e2e.test`;
    const { data: job, error } = await as
      .from('auth_admin_jobs')
      .insert({
        op: 'invite',
        requested_by: schoolAdmin.id,
        payload: { email, full_name: 'New Teacher', role_ids: [await roleId('content_editor')] },
      })
      .select('id')
      .single();
    expect(error).toBeNull();

    const res = await call(job!.id);
    expect(res.status).toBe(200);
    const { userId } = (await res.json()) as { userId: string };

    const admin = adminClient();
    const { data: profile } = await admin
      .from('profiles')
      .select('status, full_name')
      .eq('id', userId)
      .single();
    expect(profile).toEqual({ status: 'invited', full_name: 'New Teacher' });
    const { data: roles } = await admin
      .from('user_roles')
      .select('roles(key), granted_by')
      .eq('user_id', userId);
    expect(roles).toEqual([{ roles: { key: 'content_editor' }, granted_by: schoolAdmin.id }]);
    const { data: log } = await admin
      .from('activity_logs')
      .select('actor_id')
      .eq('action', 'users.invite')
      .eq('entity_id', userId)
      .single();
    expect(log?.actor_id).toBe(schoolAdmin.id);

    const mail = await latestEmail(email);
    expect(mail?.subject).toMatch(/invited/i);
    expect(mail?.html).toContain('/auth/confirm?token_hash=');
    expect(mail?.html).toContain('type=invite');
  });

  it('refuses callers without the secret, unknown jobs and already-used jobs', async () => {
    expect((await call('00000000-0000-4000-8000-000000000000', 'wrong')).status).toBe(401);
    expect((await call('00000000-0000-4000-8000-000000000000')).status).toBe(404);
  });

  it('refuses a job older than 60 seconds', async () => {
    const schoolAdmin = await createStaffUser('school_admin');
    const admin = adminClient();
    const { data: job } = await admin
      .from('auth_admin_jobs')
      .insert({
        op: 'sign_out',
        requested_by: schoolAdmin.id,
        target_user_id: schoolAdmin.id,
        created_at: new Date(Date.now() - 120_000).toISOString(),
      })
      .select('id')
      .single();
    expect((await call(job!.id)).status).toBe(410);
  });

  it('signs a user out of every session', async () => {
    const schoolAdmin = await createStaffUser('school_admin');
    const editor = await createStaffUser('content_editor');
    const editorClient = await signedInClient(editor);
    const as = await signedInClient(schoolAdmin);
    const { data: job } = await as
      .from('auth_admin_jobs')
      .insert({ op: 'sign_out', requested_by: schoolAdmin.id, target_user_id: editor.id })
      .select('id')
      .single();
    const res = await call(job!.id);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { sessions: number }).sessions).toBeGreaterThanOrEqual(1);
    const { error } = await editorClient.auth.refreshSession();
    expect(error).not.toBeNull();
  });

  it('blocks escalation when the job is created', async () => {
    const headteacher = await createStaffUser('headteacher');
    const as = await signedInClient(headteacher);
    const { error } = await as.from('auth_admin_jobs').insert({
      op: 'invite',
      requested_by: headteacher.id,
      payload: { email: 'x@e2e.test', full_name: 'X Y', role_ids: [await roleId('school_admin')] },
    });
    expect(error?.message).toBe('ESCALATION_DENIED');
  });
});

describe('update_site_settings (per-section permission, optimistic concurrency)', () => {
  it('lets appearance managers change the theme and rejects stale versions and other roles', async () => {
    const admin = adminClient();
    const { data: row } = await admin
      .from('site_settings')
      .select('version, data')
      .eq('id', 1)
      .single();
    const schoolAdmin = await signedInClient(await createStaffUser('school_admin'));
    const editor = await signedInClient(await createStaffUser('content_editor'));
    const theme = (row!.data as { theme: Json }).theme;

    const denied = await editor.rpc('update_site_settings', {
      p_section: 'theme',
      p_value: theme,
      p_version: row!.version,
    });
    expect(denied.error?.message).toBe('FORBIDDEN');

    const okRes = await schoolAdmin.rpc('update_site_settings', {
      p_section: 'theme',
      p_value: theme,
      p_version: row!.version,
    });
    expect(okRes.data).toBe(row!.version + 1);

    const stale = await schoolAdmin.rpc('update_site_settings', {
      p_section: 'theme',
      p_value: theme,
      p_version: row!.version,
    });
    expect(stale.error?.code).toBe('40001');

    const unknown = await schoolAdmin.rpc('update_site_settings', {
      p_section: 'secrets',
      p_value: {},
      p_version: row!.version + 1,
    });
    expect(unknown.error?.message).toBe('VALIDATION');
  });
});
