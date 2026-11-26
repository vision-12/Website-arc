'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, CornerDownRight, CornerUpLeft, FileText, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/shared/empty-state';
import { StatusBadge } from '@/components/shared/status-badge';
import { toast } from '@/components/ui/toast';
import { useHydrated } from '@/hooks/use-hydrated';
import { useSearchParam } from '@/hooks/use-search-param';
import { formatDateTimeShort } from '@/lib/dates/zoned';
import { cn } from '@/lib/utils';
import type { ContentStatus } from '@/features/content/lifecycle';
import { movePage, reorderPages } from '../actions';
import { MAX_PAGE_DEPTH } from '../schema';
import { inTreeOrder, type PageListItem } from '../tree';

type Filter = 'all' | ContentStatus;
const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'All pages' },
  { key: 'published', label: 'On website' },
  { key: 'draft', label: 'Drafts' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'in_review', label: 'Waiting for approval' },
];
const isFilter = (v: string | null): v is Filter => FILTERS.some((f) => f.key === v);

/** Height of a page's subtree below it (0 = no sub-pages). */
function heightBelow(pages: PageListItem[], id: string): number {
  const children = pages.filter((p) => p.parentId === id);
  return children.length === 0 ? 0 : 1 + Math.max(...children.map((c) => heightBelow(pages, c.id)));
}

/**
 * The page tree (spec §5.4 `/admin/pages`). Reordering and nesting use buttons that work by
 * keyboard, touch and on old tablets (plan P4-J); drag-and-drop arrives with Phase 5.
 */
export function PageTree({
  pages,
  canEdit,
  timezone,
}: {
  pages: PageListItem[];
  canEdit: boolean;
  timezone: string;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const fromUrl = useSearchParam('status');
  const [chosen, setChosen] = useState<Filter | null>(null);
  const [q, setQ] = useState('');
  const [pending, start] = useTransition();
  const filter: Filter = chosen ?? (isFilter(fromUrl) ? fromUrl : 'all');
  const filtering = filter !== 'all' || q.trim() !== '';

  const ordered = inTreeOrder(pages);
  const term = q.trim().toLowerCase();
  const shown = ordered.filter(
    (p) =>
      (filter === 'all' || p.status === filter) && (!term || p.title.toLowerCase().includes(term)),
  );

  const siblingsOf = (p: PageListItem) => ordered.filter((s) => s.parentId === p.parentId);

  const act = (label: string, work: () => Promise<{ ok: boolean; error?: { message: string } }>) =>
    start(async () => {
      const r = await work();
      if (r.ok) {
        toast.success(label);
        router.refresh();
      } else toast.error('Not moved', r.error?.message);
    });

  const moveBy = (p: PageListItem, delta: -1 | 1) => {
    const list = siblingsOf(p).map((s) => s.id);
    const i = list.indexOf(p.id);
    const other = list[i + delta];
    if (i < 0 || other === undefined) return;
    list[i + delta] = p.id;
    list[i] = other;
    act(`Moved ‘${p.title}’ ${delta < 0 ? 'up' : 'down'}`, () =>
      reorderPages({ parentId: p.parentId, ids: list }),
    );
  };

  if (pages.length === 0)
    return (
      <EmptyState
        icon={FileText}
        title="No pages yet"
        description="Add your first page, such as “About the school”. You decide whether it appears in the menu."
      />
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="w-full max-w-sm space-y-1.5">
          <Label htmlFor="page-search">Search pages</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="page-search"
              type="search"
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              size="sm"
              className="h-9 rounded-full"
              variant={filter === f.key ? 'default' : 'outline'}
              aria-pressed={filter === f.key}
              onClick={() => setChosen(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {filtering ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {shown.length} {shown.length === 1 ? 'page' : 'pages'}. Clear the search and filters to
          change the order.
        </p>
      ) : null}

      {shown.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          No pages match.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card" aria-label="Pages">
          {shown.map((p) => {
            const siblings = siblingsOf(p);
            const index = siblings.findIndex((s) => s.id === p.id);
            const above = index > 0 ? siblings[index - 1] : undefined;
            const parent = p.parentId ? pages.find((x) => x.id === p.parentId) : undefined;
            const canNest =
              above !== undefined &&
              above.depth + 1 + heightBelow(pages, p.id) <= MAX_PAGE_DEPTH &&
              !p.systemKey;
            const tools = canEdit && !filtering;
            return (
              <li
                key={p.id}
                className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center"
                style={
                  filtering ? undefined : { paddingInlineStart: `${0.75 + (p.depth - 1) * 1.5}rem` }
                }
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/pages/${p.id}` as Route}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {p.title}
                    </Link>
                    <StatusBadge status={p.status} />
                    {p.systemKey ? (
                      <span className="text-xs text-muted-foreground">Built-in page</span>
                    ) : null}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {p.path}
                    {p.status === 'scheduled' && p.publishAt
                      ? ` · goes live ${formatDateTimeShort(p.publishAt, timezone)}`
                      : ''}
                  </p>
                </div>
                {tools ? (
                  <div className={cn('flex flex-wrap gap-1', pending && 'opacity-60')}>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={!hydrated || pending || index <= 0}
                      onClick={() => moveBy(p, -1)}
                      title="Move up"
                    >
                      <ArrowUp aria-hidden="true" />
                      <span className="sr-only">Move ‘{p.title}’ up</span>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={!hydrated || pending || index === siblings.length - 1}
                      onClick={() => moveBy(p, 1)}
                      title="Move down"
                    >
                      <ArrowDown aria-hidden="true" />
                      <span className="sr-only">Move ‘{p.title}’ down</span>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={!hydrated || pending || !canNest}
                      title="Move into the page above"
                      onClick={() =>
                        above &&
                        act(`Moved ‘${p.title}’ inside ‘${above.title}’`, () =>
                          movePage({ id: p.id, version: p.version, parentId: above.id }),
                        )
                      }
                    >
                      <CornerDownRight aria-hidden="true" />
                      <span className="sr-only">Move ‘{p.title}’ into the page above</span>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={!hydrated || pending || !parent || p.systemKey !== null}
                      title="Move out of its section"
                      onClick={() =>
                        parent &&
                        act(`Moved ‘${p.title}’ out of ‘${parent.title}’`, () =>
                          movePage({ id: p.id, version: p.version, parentId: parent.parentId }),
                        )
                      }
                    >
                      <CornerUpLeft aria-hidden="true" />
                      <span className="sr-only">Move ‘{p.title}’ out of its section</span>
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
