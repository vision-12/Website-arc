import { createServerClient } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';
import type { Database } from '@/types/database';

export interface SessionClaims {
  sub: string;
  aal?: string;
  [key: string]: unknown;
}

/**
 * Refreshes the Supabase session cookies on every request and returns the verified claims
 * (MP §2.4: getClaims(), never getSession()). `makeResponse` builds the response the cookies go on.
 */
export async function refreshSession(
  request: NextRequest,
  makeResponse: () => NextResponse,
): Promise<{ response: NextResponse; claims: SessionClaims | null }> {
  let response = makeResponse();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { response, claims: null };

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = makeResponse();
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });

  // Do not run code between createServerClient and getClaims (Supabase SSR guidance).
  const { data, error } = await supabase.auth.getClaims();
  const claims = !error && data?.claims ? (data.claims as SessionClaims) : null;
  return { response, claims };
}
