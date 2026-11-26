'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { ImageIcon, LayoutGrid, List, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/shared/empty-state';
import { toast } from '@/components/ui/toast';
import { useSearchParam } from '@/hooks/use-search-param';
import { formatFileSize } from '@/lib/format/file-size';
import { cn } from '@/lib/utils';
import { mediaUsages, searchMedia } from '../actions';
import type { MediaItem, MediaListInput, MediaPage, MediaUsage } from '../schema';
import { MediaDetails, type MediaPermissions } from './media-details';
import { MediaThumb } from './media-thumb';
import { MediaUploader } from './media-uploader';

type Filter = 'all' | 'image' | 'document' | 'missingAlt';
const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'Everything' },
  { key: 'image', label: 'Photos' },
  { key: 'document', label: 'PDFs' },
  { key: 'missingAlt', label: 'Photos needing a description' },
];

const toInput = (filter: Filter, q: string, page: number): MediaListInput => ({
  page,
  ...(q ? { q } : {}),
  ...(filter === 'image' || filter === 'document' ? { kind: filter } : {}),
  ...(filter === 'missingAlt' ? { missingAlt: true } : {}),
});

const needsDescription = (item: MediaItem) => item.kind === 'image' && item.altText === '';

/** The media library (MP §5.9, PRD §6.5): grid or list, search, filters, details drawer. */
export function MediaLibrary({ initial, can }: { initial: MediaPage; can: MediaPermissions }) {
  const [items, setItems] = useState(initial.items);
  const [total, setTotal] = useState(initial.total);
  const [page, setPage] = useState(1);
  // The dashboard links here with ?filter=missing-description (MP §5.10: tiles open filtered lists).
  const fromUrl = useSearchParam('filter') === 'missing-description' ? 'missingAlt' : null;
  const [chosen, setFilter] = useState<Filter | null>(null);
  const filter: Filter = chosen ?? fromUrl ?? 'all';
  const [q, setQ] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [usages, setUsages] = useState<MediaUsage[] | null>(null);
  const [loading, start] = useTransition();
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = (nextFilter: Filter, nextQ: string, nextPage: number) =>
    start(async () => {
      const r = await searchMedia(toInput(nextFilter, nextQ, nextPage));
      if (!r.ok) return toast.error('The library could not be loaded', r.error.message);
      setItems((list) => (nextPage === 1 ? r.data.items : [...list, ...r.data.items]));
      setTotal(r.data.total);
      setPage(nextPage);
    });

  useEffect(() => {
    if (fromUrl) load(fromUrl, '', 1);
  }, [fromUrl]);

  const open = (item: MediaItem) => {
    setSelected(item);
    setUsages(null);
    void mediaUsages({ id: item.id }).then((r) => setUsages(r.ok ? r.data : []));
  };

  const replaceItem = (updated: MediaItem) => {
    setItems((list) => list.map((i) => (i.id === updated.id ? updated : i)));
    setSelected(updated);
  };

  return (
    <div className="space-y-6">
      {can.create ? (
        <MediaUploader
          onUploaded={(item) => {
            setItems((list) => [item, ...list.filter((i) => i.id !== item.id)]);
            setTotal((t) => t + 1);
          }}
        />
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="w-full max-w-sm space-y-1.5">
          <Label htmlFor="media-search">Search the library</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="media-search"
              type="search"
              className="pl-9"
              placeholder="File name or description"
              value={q}
              onChange={(e) => {
                const value = e.target.value;
                setQ(value);
                clearTimeout(searchTimer.current);
                searchTimer.current = setTimeout(() => load(filter, value.trim(), 1), 300);
              }}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <Button
                key={f.key}
                size="sm"
                variant={filter === f.key ? 'default' : 'outline'}
                aria-pressed={filter === f.key}
                className="h-9 rounded-full"
                onClick={() => {
                  setFilter(f.key);
                  load(f.key, q.trim(), 1);
                }}
              >
                {f.label}
              </Button>
            ))}
          </div>
          <div role="group" aria-label="Layout" className="flex gap-1">
            <Button
              size="icon"
              variant={view === 'grid' ? 'secondary' : 'ghost'}
              aria-pressed={view === 'grid'}
              onClick={() => setView('grid')}
            >
              <LayoutGrid aria-hidden="true" />
              <span className="sr-only">Show as a grid</span>
            </Button>
            <Button
              size="icon"
              variant={view === 'list' ? 'secondary' : 'ghost'}
              aria-pressed={view === 'list'}
              onClick={() => setView('list')}
            >
              <List aria-hidden="true" />
              <span className="sr-only">Show as a list</span>
            </Button>
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {loading ? 'Loading…' : `${total} ${total === 1 ? 'file' : 'files'}`}
      </p>

      {items.length === 0 && !loading ? (
        <EmptyState
          icon={ImageIcon}
          title={filter === 'all' && !q ? 'No photos or documents yet' : 'Nothing matches'}
          description={
            filter === 'all' && !q
              ? 'Upload your first photo. Once it has a description, you can use it on any page of the website.'
              : 'Try another search or filter.'
          }
        />
      ) : view === 'grid' ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => open(item)}
                className="group w-full overflow-hidden rounded-lg border bg-card text-left hover:border-primary"
              >
                <MediaThumb item={item} />
                <span className="block space-y-1 p-2">
                  <span className="block truncate text-sm font-medium">{item.filename}</span>
                  {needsDescription(item) ? (
                    <Badge variant="warning">Needs a description</Badge>
                  ) : (
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.kind === 'image'
                        ? item.altText
                        : `PDF, ${formatFileSize(item.sizeBytes)}`}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => open(item)}
                className="flex w-full items-center gap-3 p-3 text-left hover:bg-accent"
              >
                <MediaThumb item={item} className="w-14 shrink-0 rounded" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{item.filename}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.kind === 'image' ? item.altText || 'No description yet' : 'PDF document'}{' '}
                    · {formatFileSize(item.sizeBytes)}
                  </span>
                </span>
                {needsDescription(item) ? (
                  <Badge variant="warning">Needs a description</Badge>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}

      {items.length < total ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => load(filter, q.trim(), page + 1)}
          >
            {loading ? 'Loading…' : 'Show more'}
          </Button>
        </div>
      ) : null}

      <MediaDetails
        item={selected}
        usages={usages}
        open={selected !== null}
        onOpenChange={(o) => !o && setSelected(null)}
        onChange={replaceItem}
        onRemoved={(id) => {
          setItems((list) => list.filter((i) => i.id !== id));
          setTotal((t) => Math.max(0, t - 1));
          setSelected(null);
        }}
        can={can}
      />
      <p className={cn('sr-only')} aria-live="polite">
        {selected ? `Showing details for ${selected.filename}` : ''}
      </p>
    </div>
  );
}
