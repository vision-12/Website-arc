import 'server-only';
import { after } from 'next/server';
import { publicEnv } from '@/lib/env/public';

/**
 * With Cache Components, the first request for an address Next hasn't rendered yet gets the
 * static shell (status 200) while the real page is generated in the background; only that
 * generated entry carries a 308 redirect or a 404. When a page's address changes, request the old
 * address once, after the response, so its first real visitor already gets the 308 (plan P4-H).
 */
export function warmAddresses(paths: readonly string[]): void {
  if (paths.length === 0) return;
  const run = async () => {
    for (const path of paths)
      await fetch(new URL(path, publicEnv.NEXT_PUBLIC_SITE_URL), {
        redirect: 'manual',
        cache: 'no-store',
      }).catch(() => undefined);
  };
  try {
    after(run);
  } catch {
    void run(); // outside a request (scripts, tests): best effort
  }
}
