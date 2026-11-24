'use client';
import { useSyncExternalStore } from 'react';

const subscribe = (onChange: () => void) => {
  window.addEventListener('popstate', onChange);
  return () => window.removeEventListener('popstate', onChange);
};

/**
 * Reads a query parameter in the browser without a Suspense boundary.
 *
 * Why not read searchParams on the server: that puts the form inside <Suspense>, so the prerendered
 * placeholder form is replaced when the real one streams in — wiping anything typed meanwhile.
 * The value is null during server rendering and hydration, then the real value.
 */
export function useSearchParam(name: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get(name),
    () => null,
  );
}
