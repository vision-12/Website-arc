/**
 * Test-only helpers for integration and E2E suites against the LOCAL Supabase stack.
 * Uses the secret key, which is fine here: never imported by application code.
 */
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export const TEST_PASSWORD = 'Test-password-2026';

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set (load .env.local / start the local Supabase stack)`);
  return v;
}

export function adminClient(): SupabaseClient<Database> {
  return createClient<Database>(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SECRET_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function anonClient(): SupabaseClient<Database> {
  return createClient<Database>(
    env('NEXT_PUBLIC_SUPABASE_URL'),
    env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

/** Creates a confirmed, active staff user with the given role (system context, so guards allow it). */
export async function createStaffUser(
  roleKey: string | null,
  opts: { status?: 'active' | 'invited' | 'deactivated'; name?: string } = {},
): Promise<TestUser> {
  const admin = adminClient();
  const email = `t-${randomUUID().slice(0, 8)}@e2e.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: opts.name ?? `Test ${roleKey ?? 'user'}` },
  });
  if (error) throw error;
  const id = data.user.id;
  const { error: statusError } = await admin
    .from('profiles')
    .update({ status: opts.status ?? 'active' })
    .eq('id', id);
  if (statusError) throw statusError;
  if (roleKey) {
    const { data: role } = await admin.from('roles').select('id').eq('key', roleKey).single();
    if (!role) throw new Error(`Unknown role ${roleKey}`);
    const { error: roleError } = await admin
      .from('user_roles')
      .insert({ user_id: id, role_id: role.id });
    if (roleError) throw roleError;
  }
  return { id, email, password: TEST_PASSWORD };
}

/** A supabase-js client signed in as the user (anon key + session). */
export async function signedInClient(user: TestUser): Promise<SupabaseClient<Database>> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error) throw error;
  return client;
}

/** Latest email Mailpit captured for an address (local stack only). */
export async function latestEmail(
  to: string,
  timeoutMs = 10_000,
): Promise<{ subject: string; html: string } | null> {
  const base = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${base}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    const list = (await res.json()) as { messages?: { ID: string; Subject: string }[] };
    const first = list.messages?.[0];
    if (first) {
      const msg = (await (await fetch(`${base}/api/v1/message/${first.ID}`)).json()) as {
        HTML: string;
        Subject: string;
      };
      return { subject: msg.Subject, html: msg.HTML };
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return null;
}

export function linkFrom(html: string): string {
  const match = /href="([^"]*\/auth\/confirm\?[^"]*)"/.exec(html);
  if (!match?.[1]) throw new Error('No confirmation link in email');
  return match[1].replaceAll('&amp;', '&');
}
