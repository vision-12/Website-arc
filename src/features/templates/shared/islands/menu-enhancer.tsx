'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const OPEN = 'details[data-tpl-menu][open]';

/**
 * Menus are native <details> disclosures, so they open and close before any JavaScript arrives.
 * Once it does, this adds what visitors expect: Escape closes the last menu and returns focus to
 * its button; a click outside, choosing a link or navigating closes menus; opening one menu closes
 * its siblings. Renders nothing.
 */
export function MenuEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    for (const menu of document.querySelectorAll<HTMLDetailsElement>(OPEN)) menu.open = false;
  }, [pathname]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const open = [...document.querySelectorAll<HTMLDetailsElement>(OPEN)];
      const last = open.at(-1);
      if (!last) return;
      last.open = false;
      last.querySelector('summary')?.focus();
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target) return;
      for (const menu of document.querySelectorAll<HTMLDetailsElement>(OPEN)) {
        if (!menu.contains(target) || target.closest('a')) menu.open = false;
      }
    };
    const onToggle = (event: Event) => {
      const menu = event.target;
      if (!(menu instanceof HTMLDetailsElement) || !menu.open || !menu.matches('[data-tpl-menu]'))
        return;
      for (const other of document.querySelectorAll<HTMLDetailsElement>(OPEN)) {
        if (other !== menu && !other.contains(menu) && !menu.contains(other)) other.open = false;
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    document.addEventListener('toggle', onToggle, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
      document.removeEventListener('toggle', onToggle, true);
    };
  }, []);

  return null;
}
