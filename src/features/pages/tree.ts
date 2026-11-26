import type { ContentStatus } from '@/features/content/lifecycle';
import { MAX_PAGE_DEPTH } from './schema';

/** The page tree, shared by the admin list (browser) and the editor's parent choices (server). */

export interface PageListItem {
  id: string;
  parentId: string | null;
  title: string;
  path: string;
  status: ContentStatus;
  publishAt: string | null;
  updatedAt: string;
  navOrder: number;
  showInNav: boolean;
  systemKey: string | null;
  version: number;
  depth: number;
}

/** Pages ordered as a tree: parents first, children after them (for lists and selects). */
export function inTreeOrder(pages: PageListItem[]): PageListItem[] {
  const byParent = new Map<string | null, PageListItem[]>();
  for (const p of pages) byParent.set(p.parentId, [...(byParent.get(p.parentId) ?? []), p]);
  const out: PageListItem[] = [];
  const walk = (parent: string | null) => {
    for (const p of byParent.get(parent) ?? []) {
      out.push(p);
      walk(p.id);
    }
  };
  walk(null);
  return out;
}

/**
 * Where a page may be placed: not inside itself or its sub-pages, and not so deep that it or its
 * sub-pages would exceed three levels (spec §1.4).
 */
export function parentOptions(pages: PageListItem[], selfId: string) {
  const ordered = inTreeOrder(pages);
  const self = pages.find((p) => p.id === selfId);
  const below = new Set<string>([selfId]);
  let height = 0;
  for (const p of ordered) {
    if (p.parentId && below.has(p.parentId)) {
      below.add(p.id);
      if (self) height = Math.max(height, p.depth - self.depth);
    }
  }
  return ordered
    .filter((p) => !below.has(p.id) && p.depth + 1 + height <= MAX_PAGE_DEPTH)
    .map((p) => ({ id: p.id, title: p.title, path: p.path, depth: p.depth }));
}
