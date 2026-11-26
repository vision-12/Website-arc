/**
 * Old addresses → new ones (spec §1.3, D12), for proxy.ts. Redirects must be answered before the
 * page renders: with Partial Prerendering the page's shell is sent first, so a redirect from the
 * page itself arrives as a 200 that only browsers follow. The table is small, so each server
 * instance keeps it in memory and refreshes it in the background every 30 seconds (plan P4-H);
 * the page route still looks one up on a miss, covering the seconds after a rename.
 */

export interface RedirectTarget {
  to: string;
  status: 301 | 302 | 307 | 308;
}

const TTL_MS = 30_000;
const MAX_ROWS = 10_000;

let cache: { map: Map<string, RedirectTarget>; fetchedAt: number } | null = null;
let inflight: Promise<void> | null = null;

async function refresh(supabaseUrl: string, key: string, now: number): Promise<void> {
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/redirects?select=from_path,to_path,status_code&limit=${MAX_ROWS}`,
      { headers: { apikey: key }, cache: 'no-store', signal: AbortSignal.timeout(3_000) },
    );
    if (!res.ok) return;
    const rows = (await res.json()) as Array<{
      from_path: string;
      to_path: string;
      status_code: number;
    }>;
    const map = new Map<string, RedirectTarget>();
    for (const r of rows) {
      if ([301, 302, 307, 308].includes(r.status_code))
        map.set(r.from_path, { to: r.to_path, status: r.status_code as RedirectTarget['status'] });
    }
    cache = { map, fetchedAt: now };
  } catch {
    // Keep serving the last good copy; try again on a later request.
  }
}

export async function lookupRedirect(
  pathname: string,
  supabaseUrl: string,
  key: string,
  now: number = Date.now(),
): Promise<RedirectTarget | null> {
  if (!cache) {
    inflight ??= refresh(supabaseUrl, key, now).finally(() => {
      inflight = null;
    });
    await inflight;
  } else if (now - cache.fetchedAt > TTL_MS) {
    inflight ??= refresh(supabaseUrl, key, now).finally(() => {
      inflight = null;
    });
  }
  return cache?.map.get(pathname) ?? null;
}

/** Paths that can be CMS content: not the app's own areas, and not files. */
export function isContentPath(pathname: string): boolean {
  if (pathname === '/' || /\.[a-z0-9]{2,5}$/i.test(pathname)) return false;
  return !/^\/(admin|api|_next|preview|login|auth|mfa|forgot-password|reset-password|accept-invite|theme\.css)(\/|$)/.test(
    pathname,
  );
}

/** Test hook: forget the in-memory copy. */
export function resetRedirectCache(): void {
  cache = null;
  inflight = null;
}
