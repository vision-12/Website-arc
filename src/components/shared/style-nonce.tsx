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
  const nonce = document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce;
  if (nonce) setNonce(nonce);
}

export function StyleNonce() {
  return null;
}
