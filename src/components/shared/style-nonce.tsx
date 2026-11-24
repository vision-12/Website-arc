'use client';
import { setNonce } from 'get-nonce';

/**
 * Radix dialogs lock page scroll via react-remove-scroll, which injects a <style> element at
 * runtime. Under our nonce-based CSP that element needs the request's nonce. Next.js stamps the
 * nonce on its own <script> tags; browsers expose it via the `nonce` property (not the attribute),
 * so we read it from there and hand it to get-nonce, which react-style-singleton consults.
 * This keeps the layout free of request data, so public pages keep their prerendered shell.
 */
if (typeof document !== 'undefined') {
  // Inline scripts only: they come from the server response and carry this document's nonce.
  // External chunk scripts inserted later by the client runtime can carry a stale nonce (harmless
  // for them, since 'self' allows them) and must not be used.
  const nonce = document.querySelector<HTMLScriptElement>('script[nonce]:not([src])')?.nonce;
  if (nonce) setNonce(nonce);
}

export function StyleNonce() {
  return null;
}
