'use client';
import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * False during server rendering and until React hydrates, then true.
 *
 * Why forms need it (ADR-000, "Forms before hydration"): on partially prerendered routes, a Server
 * Action submitted natively before hydration gets back only the streamed dynamic segments — no page
 * shell and no form state — so the visitor sees a broken page. Submit buttons stay disabled until
 * hydration so that can't happen.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
