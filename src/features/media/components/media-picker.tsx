'use client';
import { useRef, useState, useTransition } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toast';
import { searchMedia } from '../actions';
import { MESSAGES, type MediaItem } from '../schema';
import { DescriptionForm } from './description-form';
import { MediaThumb } from './media-thumb';
import { MediaUploader } from './media-uploader';

/**
 * Choose a photo or PDF from the library, or upload one, from the editor. A photo without a
 * description can't be inserted: the picker asks for one on the spot (MP §5.9 "required alt text
 * before an image can be inserted"); the database refuses it too (ALT_TEXT_REQUIRED).
 */
export function MediaPicker({
  open,
  onOpenChange,
  kind,
  onSelect,
  canUpload,
  canDescribe,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: 'image' | 'document';
  onSelect: (item: MediaItem) => void;
  canUpload: boolean;
  canDescribe: boolean;
}) {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [q, setQ] = useState('');
  const [describing, setDescribing] = useState<MediaItem | null>(null);
  const [loading, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const noun = kind === 'image' ? 'photo' : 'PDF';

  const load = (query: string) =>
    start(async () => {
      const r = await searchMedia({ kind, page: 1, ...(query ? { q: query } : {}) });
      if (r.ok) setItems(r.data.items);
      else toast.error('The library could not be loaded', r.error.message);
    });

  const choose = (item: MediaItem) => {
    if (item.kind === 'image' && item.altText === '') return setDescribing(item);
    onSelect(item);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) load(q.trim());
        else setDescribing(null);
        onOpenChange(o);
      }}
    >
      <DialogContent closeLabel="Close" className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        {describing ? (
          <>
            <DialogHeader>
              <DialogTitle>Describe this photo first</DialogTitle>
              <DialogDescription>{MESSAGES.missingAlt}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
              <MediaThumb item={describing} className="rounded-lg" />
              {canDescribe ? (
                <DescriptionForm
                  item={describing}
                  required
                  focusOnOpen
                  submitLabel="Save and insert"
                  onSaved={(updated) => {
                    setItems(
                      (list) => list?.map((i) => (i.id === updated.id ? updated : i)) ?? null,
                    );
                    setDescribing(null);
                    onSelect(updated);
                    onOpenChange(false);
                  }}
                />
              ) : (
                <p className="text-sm">
                  You can’t add descriptions. Ask someone who looks after the media library to
                  describe this photo, or choose another one.
                </p>
              )}
            </div>
            <Button variant="ghost" className="w-fit" onClick={() => setDescribing(null)}>
              <ArrowLeft aria-hidden="true" />
              Back to the library
            </Button>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{kind === 'image' ? 'Choose a photo' : 'Choose a PDF'}</DialogTitle>
              <DialogDescription>
                {kind === 'image'
                  ? 'Photos need a description before they can be added to a page.'
                  : 'The link will always open the current version of the document.'}
              </DialogDescription>
            </DialogHeader>
            {canUpload ? (
              <MediaUploader
                compact
                accept={kind === 'image' ? 'images' : 'documents'}
                onUploaded={(item) => {
                  setItems((list) => [item, ...(list ?? [])]);
                  choose(item);
                }}
              />
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="picker-search">Search</Label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="picker-search"
                  type="search"
                  className="pl-9"
                  value={q}
                  onChange={(e) => {
                    const value = e.target.value;
                    setQ(value);
                    clearTimeout(timer.current);
                    timer.current = setTimeout(() => load(value.trim()), 300);
                  }}
                />
              </div>
            </div>
            {items === null || (loading && items.length === 0) ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No {noun}s {q ? 'match that search' : 'in the library yet'}.
              </p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => choose(item)}
                      className="w-full overflow-hidden rounded-lg border bg-card text-left hover:border-primary"
                    >
                      <MediaThumb item={item} />
                      <span className="block space-y-1 p-2">
                        <span className="block truncate text-sm font-medium">{item.filename}</span>
                        {item.kind === 'image' && item.altText === '' ? (
                          <Badge variant="warning">Needs a description</Badge>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
