import type { ResolvedLink } from '../types';
import { isExternalHref } from '@/lib/rich-text/safe-href';

type Target = { href: string } | { pageId: string };

/** Page ids a set of link targets refers to, for one batched lookup. */
export function pageIdsOf(targets: readonly Target[]): string[] {
  return targets.flatMap((t) => ('pageId' in t ? [t.pageId] : []));
}

/**
 * Turns a stored link target into an href. A link to a page that isn't published (or no longer
 * exists) resolves to null, and callers leave it out rather than show a dead link.
 */
export function resolveHref(target: Target, pagePaths: Record<string, string>): string | null {
  if ('href' in target) return target.href;
  return pagePaths[target.pageId] ?? null;
}

export function resolveLink(
  link: Target & { label: string },
  pagePaths: Record<string, string>,
): ResolvedLink | null {
  const href = resolveHref(link, pagePaths);
  return href ? { label: link.label, href, external: isExternalHref(href) } : null;
}
