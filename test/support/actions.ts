/**
 * Runs Server Actions in integration tests as a real signed-in user against the local stack.
 * Each test file mocks `@/lib/supabase/server` so `createClient()` returns the client set with
 * `actAs()`, and `next/cache` so tag expiries are recorded instead of needing a Next request:
 *
 *   vi.mock('@/lib/supabase/server', async (orig) => (await import('…/actions')).serverMock(orig));
 *   vi.mock('next/cache', async () => (await import('…/actions')).cacheMock());
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { anonClient, createStaffUser, signedInClient, type TestUser } from './supabase';

type Client = SupabaseClient<Database>;

let current: Client | null = null;
export const expiredTags: string[] = [];

export function actAs(client: Client | null): void {
  current = client;
}

/** Creates a staff user with the role, signs in, and makes later actions run as them. */
export async function signInAs(role: string): Promise<{ user: TestUser; client: Client }> {
  const user = await createStaffUser(role);
  const client = await signedInClient(user);
  actAs(client);
  return { user, client };
}

export async function serverMock(importOriginal: () => Promise<unknown>) {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    // actAs(null) = a signed-out visitor: no session, so getAccess() returns null.
    createClient: () => Promise.resolve(current ?? anonClient()),
  };
}

export function cacheMock() {
  return {
    updateTag: (tag: string) => void expiredTags.push(tag),
    revalidateTag: (tag: string) => void expiredTags.push(tag),
    cacheTag: () => undefined,
    cacheLife: () => undefined,
    revalidatePath: () => undefined,
  };
}

/** Uploads bytes to a signed upload URL the way the browser uploader does. */
export async function putToSignedUrl(signedUrl: string, bytes: Uint8Array, contentType: string) {
  const res = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'content-type': contentType, 'x-upsert': 'false' },
    body: Buffer.from(bytes),
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status} ${await res.text()}`);
}
