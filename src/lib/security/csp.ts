/**
 * Content-Security-Policy builder (MASTER_PROMPT §7.5, decision P1-A: nonce on every route).
 * Pure function so it can be unit-tested; called from src/proxy.ts per request.
 */
export interface CspOptions {
  nonce: string;
  supabaseUrl: string;
  /** Development needs 'unsafe-eval' for React's dev tooling and ws: for HMR. */
  isDev?: boolean;
  /** 'self' only for the template preview, which the Appearance page embeds (spec §6.4). */
  frameAncestors?: 'none' | 'self';
  /**
   * Admin pages only: lets WebAssembly compile, for converting iPhone (HEIC) photos in the browser
   * before upload (ADR-018). It does not allow eval() of strings.
   */
  allowWasm?: boolean;
}

/** Third-party hosts the site may show images from (video thumbnails, static maps). */
export const IMAGE_HOSTS = [
  'https://i.ytimg.com',
  'https://i.vimeocdn.com',
  'https://maps.googleapis.com',
  'https://api.maptiler.com',
  'https://tile.openstreetmap.org',
] as const;

/** Embeds that load only after a click (facades): video players and the interactive map. */
export const FRAME_HOSTS = [
  'https://www.youtube-nocookie.com',
  'https://player.vimeo.com',
  'https://www.google.com',
] as const;

export function buildCsp({
  nonce,
  supabaseUrl,
  isDev = false,
  frameAncestors = 'none',
  allowWasm = false,
}: CspOptions): string {
  if (!/^[A-Za-z0-9+/=_-]{16,}$/.test(nonce)) throw new Error('CSP nonce is missing or malformed');
  const supabase = new URL(supabaseUrl).origin;
  const supabaseWs = supabase.replace(/^http/, 'ws');

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      "'sha256-7mu4H06fwDCjmnxxr/xNHyuQC6pLTHr4M2E4jXw5WZs='",
      ...(allowWasm ? ["'wasm-unsafe-eval'"] : []),
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    // <style> elements need the nonce. Inline style *attributes* (emitted by React/next/image for
    // layout) are allowed separately; they cannot load resources or run script.
    'style-src-elem': ["'self'", `'nonce-${nonce}'`, ...(isDev ? ["'unsafe-inline'"] : [])],
    'style-src-attr': ["'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', supabase, ...IMAGE_HOSTS],
    'font-src': ["'self'"],
    'connect-src': ["'self'", supabase, supabaseWs, ...(isDev ? ['ws:'] : [])],
    'frame-src': [...FRAME_HOSTS],
    'media-src': ["'self'", supabase],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': [frameAncestors === 'self' ? "'self'" : "'none'"],
    'base-uri': ["'none'"],
    'object-src': ["'none'"],
  };
  if (isDev && directives['style-src-elem']) {
    // Dev overlay injects styles without a nonce; a nonce source disables 'unsafe-inline', so drop it.
    directives['style-src-elem'] = ["'self'", "'unsafe-inline'"];
  }

  const parts = Object.entries(directives).map(([k, v]) => `${k} ${v.join(' ')}`);
  if (!isDev) parts.push('upgrade-insecure-requests');
  return parts.join('; ');
}

/** 128 bits of randomness, base64-encoded. */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
