import 'server-only';
import { cookies } from 'next/headers';
import { connection } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { PostgrestClient } from '@supabase/postgrest-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env/public';
import type { Database } from '@/types/database';

export type TypedClient = SupabaseClient<Database>;

/**
 * User-scoped, cookie-based client — the default for Server Components, Server Actions and Route
 * Handlers (MP §4.2). Runs with the signed-in user's JWT, so RLS applies.
 * Never call this inside a `'use cache'` scope (cookies are request data).
 */
export async function createClient(): Promise<TypedClient> {
  // Request-time only. Under Cache Components, cookies() is "runtime data" that Next may still
  // prerender (runtime prefetch); the auth client reads the clock on start-up, and user data must
  // never be prerendered or cached anyway (MP §2.5).
  await connection();
  const cookieStore = await cookies();
  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
          } catch {
            // Called from a Server Component, where cookies are read-only; proxy.ts refreshes the session.
          }
        },
      },
    },
  );
}

/**
 * Cookie-less, auth-less data client with the publishable key: exactly what an anonymous visitor may
 * read. The ONLY client allowed inside `'use cache'` (spec D7). Built on PostgREST alone — the full
 * supabase-js client starts auth timers (Date.now) that break prerendering.
 */
export function createPublicClient() {
  return new PostgrestClient<Database>(`${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`, {
    headers: { apikey: publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
  });
}
