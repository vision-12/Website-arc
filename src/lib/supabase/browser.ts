'use client';
import { createBrowserClient } from '@supabase/ssr';
import { publicEnv } from '@/lib/env/public';
import type { Database } from '@/types/database';

/** Client components only — e.g. direct-to-storage uploads with signed tokens (MP §4.2). */
export function createClient() {
  return createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
