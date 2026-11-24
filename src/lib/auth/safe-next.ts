/**
 * Sanitises a post-login redirect target: same-origin paths only (no open redirects).
 * Anything suspicious falls back to the admin overview.
 */
export const DEFAULT_AFTER_LOGIN = '/admin/overview';

export function safeNext(value: unknown, fallback: string = DEFAULT_AFTER_LOGIN): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  if (/[\u0000-\u001f\\]/.test(value)) return fallback;
  try {
    const url = new URL(value, 'https://placeholder.invalid');
    if (url.origin !== 'https://placeholder.invalid') return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
