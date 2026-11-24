import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env/public';
import type { Database } from '@/types/database';

/**
 * SECRET-KEY client: bypasses RLS. Allowed ONLY in src/app/api/cron/**, src/app/api/webhooks/** and
 * scripts/** (CLAUDE.md, enforced by ESLint no-restricted-imports). Never in a request path.
 */
export function createAdminClient(): SupabaseClient<Database> {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key?.startsWith('sb_secret_')) throw new Error('SUPABASE_SECRET_KEY is not configured');
  return createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
