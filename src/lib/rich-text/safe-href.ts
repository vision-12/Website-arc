const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/**
 * Returns the link target if it is safe to render: a site path, an in-page anchor, or an
 * http(s), mailto or tel URL. Anything else (javascript:, data:, protocol-relative //host, …)
 * returns null and the text is rendered without a link.
 */
export function safeHref(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const href = raw.trim();
  if (href === '' || href.length > 2048) return null;
  if (href.startsWith('#')) return href;
  if (href.startsWith('/')) return href.startsWith('//') || href.startsWith('/\\') ? null : href;
  try {
    return SAFE_PROTOCOLS.has(new URL(href).protocol) ? href : null;
  } catch {
    return null;
  }
}

/** True for links that leave the school's website. */
export function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}
