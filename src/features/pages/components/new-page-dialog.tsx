'use client';
import { useState, useTransition } from 'react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { useHydrated } from '@/hooks/use-hydrated';
import { createPage } from '../actions';
import { CreatePageInput, MAX_PAGE_DEPTH } from '../schema';
import { inTreeOrder, type PageListItem } from '../tree';

/** "New page": a title and a place; the editor opens with a draft (spec §4.1 create). */
export function NewPageDialog({ pages }: { pages: PageListItem[] }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [parentId, setParentId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const parents = inTreeOrder(pages).filter((p) => p.depth < MAX_PAGE_DEPTH);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={!hydrated}>
          <Plus aria-hidden="true" />
          New page
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel="Close">
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const input = { title, parentId: parentId || null };
            const checked = CreatePageInput.safeParse(input);
            if (!checked.success)
              return setError(checked.error.issues[0]?.message ?? 'Please check the title.');
            setError(null);
            start(async () => {
              const r = await createPage(checked.data);
              if (r.ok) router.push(`/admin/pages/${r.data.id}` as Route);
              else setError(r.error.message);
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>New page</DialogTitle>
            <DialogDescription>
              It starts as a draft: nobody sees it until you publish it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="new-page-title">Page title</Label>
            <Input
              id="new-page-title"
              value={title}
              maxLength={150}
              onChange={(e) => setTitle(e.target.value)}
              aria-invalid={error ? true : undefined}
              {...(error ? { 'aria-describedby': 'new-page-error' } : {})}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-page-parent">Where it sits</Label>
            <NativeSelect
              id="new-page-parent"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">At the top level</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {'— '.repeat(p.depth)}Inside “{p.title}”
                </option>
              ))}
            </NativeSelect>
          </div>
          {error ? (
            <p id="new-page-error" role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create and edit'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
