'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, ImageIcon, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/shared/empty-state';
import { toast } from '@/components/ui/toast';
import { useHydrated } from '@/hooks/use-hydrated';
import { purgeMedia, restoreMedia } from '@/features/media/actions';
import { purgePage, restorePage } from '@/features/pages/actions';

export interface TrashItem {
  id: string;
  kind: 'page' | 'photo' | 'document';
  title: string;
  deletedOn: string;
  deletedBy: string | null;
  keptUntil: string;
  canRestore: boolean;
}

const KIND_LABEL = { page: 'Page', photo: 'Photo', document: 'PDF' } as const;

/** Trash (MP §11): restore for 30 days; permanent delete needs trash.purge and the typed name. */
export function TrashList({ items, canPurge }: { items: TrashItem[]; canPurge: boolean }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [pending, start] = useTransition();
  const [purging, setPurging] = useState<TrashItem | null>(null);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);

  const restore = (item: TrashItem) =>
    start(async () => {
      const r =
        item.kind === 'page'
          ? await restorePage({ id: item.id })
          : await restoreMedia({ id: item.id });
      if (!r.ok) return toast.error('Not restored', r.error.message);
      const renamed = 'renamed' in r.data && r.data.renamed;
      toast.success(
        `Restored ‘${item.title}’`,
        renamed
          ? 'Its old address was taken, so it was given a new one ending in a number.'
          : undefined,
      );
      router.refresh();
    });

  if (items.length === 0)
    return (
      <EmptyState
        icon={Trash2}
        title="Trash is empty"
        description="Pages and files you move to Trash stay here for 30 days, so you can restore them."
      />
    );

  return (
    <>
      <ul className="divide-y rounded-xl border bg-card" aria-label="Items in Trash">
        {items.map((item) => {
          const Icon = item.kind === 'page' ? FileText : ImageIcon;
          return (
            <li
              key={`${item.kind}:${item.id}`}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
            >
              <Icon
                className="hidden size-5 shrink-0 text-muted-foreground sm:block"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium break-words">{item.title}</span>
                  <Badge variant="neutral">{KIND_LABEL[item.kind]}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Moved to Trash on {item.deletedOn}
                  {item.deletedBy ? ` by ${item.deletedBy}` : ''}. Kept until {item.keptUntil}.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {item.canRestore ? (
                  <Button
                    variant="outline"
                    disabled={!hydrated || pending}
                    onClick={() => restore(item)}
                  >
                    Restore
                    <span className="sr-only"> ‘{item.title}’</span>
                  </Button>
                ) : null}
                {canPurge ? (
                  <Button
                    variant="ghost"
                    className="text-destructive"
                    disabled={!hydrated || pending}
                    onClick={() => {
                      setPurging(item);
                      setTyped('');
                      setError(null);
                    }}
                  >
                    Delete permanently
                    <span className="sr-only"> ‘{item.title}’</span>
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <Dialog open={purging !== null} onOpenChange={(o) => !o && setPurging(null)}>
        <DialogContent closeLabel="Close">
          {purging ? (
            <form
              className="space-y-4"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                start(async () => {
                  const input = { id: purging.id, confirmTitle: typed };
                  const r =
                    purging.kind === 'page' ? await purgePage(input) : await purgeMedia(input);
                  if (!r.ok) return setError(r.error.message);
                  toast.success(`Deleted ‘${purging.title}’ permanently`);
                  setPurging(null);
                  router.refresh();
                });
              }}
            >
              <DialogHeader>
                <DialogTitle>Delete ‘{purging.title}’ permanently?</DialogTitle>
                <DialogDescription>
                  This can’t be undone. Type the name exactly as shown to confirm.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5">
                <Label htmlFor="purge-confirm">Name</Label>
                <Input
                  id="purge-confirm"
                  value={typed}
                  autoComplete="off"
                  onChange={(e) => setTyped(e.target.value)}
                  aria-invalid={error ? true : undefined}
                  {...(error ? { 'aria-describedby': 'purge-error' } : {})}
                />
              </div>
              {error ? (
                <p id="purge-error" role="alert" className="text-sm font-medium text-destructive">
                  {error}
                </p>
              ) : null}
              <DialogFooter>
                <Button variant="outline" onClick={() => setPurging(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="destructive" disabled={pending}>
                  Delete permanently
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
