'use client';
import { useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Route } from 'next';
import { ExternalLink, FileText, RefreshCw, Trash2 } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { toast } from '@/components/ui/toast';
import { useHydrated } from '@/hooks/use-hydrated';
import { formatFileSize } from '@/lib/format/file-size';
import { cn } from '@/lib/utils';
import { trashMedia } from '../actions';
import type { MediaItem, MediaUsage } from '../schema';
import { DescriptionForm } from './description-form';
import { replaceInLibrary, uploadErrorMessage } from './upload-client';

export interface MediaPermissions {
  create: boolean;
  edit: boolean;
  delete: boolean;
}

/**
 * The details drawer (spec §5.4 /admin/media): description and caption, "Used in" with links,
 * replace in place (same id), and Trash — refused while the file is used (MP §5.9).
 */
export function MediaDetails({
  item,
  usages,
  open,
  onOpenChange,
  onChange,
  onRemoved,
  can,
}: {
  item: MediaItem | null;
  usages: MediaUsage[] | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (item: MediaItem) => void;
  onRemoved: (id: string) => void;
  can: MediaPermissions;
}) {
  const hydrated = useHydrated();
  const [replacing, setReplacing] = useState<string | null>(null);
  const [, start] = useTransition();
  if (!item) return null;
  const inUse = (usages?.length ?? 0) > 0;

  const replace = (file: File) => {
    setReplacing('Getting the file ready…');
    replaceInLibrary(item, file, (stage, p) =>
      setReplacing(
        stage === 'uploading'
          ? `Uploading ${Math.round((p ?? 0) * 100)}%`
          : stage === 'checking'
            ? 'Checking the file…'
            : 'Getting the file ready…',
      ),
    )
      .then((updated) => {
        onChange(updated);
        toast.success('File replaced', 'Every page that uses it now shows the new file.');
      })
      .catch((e: unknown) => toast.error('The file was not replaced', uploadErrorMessage(e)))
      .finally(() => setReplacing(null));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetTitle className="pr-10 break-words">{item.filename}</SheetTitle>
        <SheetDescription>
          {item.kind === 'image' ? 'Photo' : 'PDF document'}, {formatFileSize(item.sizeBytes)}
          {item.width && item.height ? `, ${item.width} × ${item.height} pixels` : ''}
        </SheetDescription>

        <div className="mt-4 space-y-6">
          {item.kind === 'image' && item.width && item.height ? (
            <Image
              src={item.url}
              alt={item.altText}
              width={item.width}
              height={item.height}
              sizes="(min-width: 640px) 400px, 90vw"
              className="h-auto w-full rounded-lg border"
              {...(item.lqip ? { placeholder: 'blur' as const, blurDataURL: item.lqip } : {})}
            />
          ) : (
            <a href={item.url} className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}>
              <FileText aria-hidden="true" />
              Open the PDF
            </a>
          )}

          {item.kind === 'image' ? (
            can.edit ? (
              <DescriptionForm
                key={`${item.id}:${item.version}`}
                item={item}
                onSaved={(updated) => {
                  onChange(updated);
                  toast.success('Description saved');
                }}
              />
            ) : (
              <div className="space-y-1">
                <h3 className="text-sm font-medium">Photo description</h3>
                <p className="text-sm">{item.altText || 'No description yet.'}</p>
              </div>
            )
          ) : null}

          <section aria-labelledby="used-in" className="space-y-2">
            <h3 id="used-in" className="text-sm font-semibold">
              Used in
            </h3>
            {usages === null ? (
              <p className="text-sm text-muted-foreground">Checking…</p>
            ) : usages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not used on the website yet.</p>
            ) : (
              <ul className="space-y-1">
                {usages.map((u) => (
                  <li key={`${u.href}:${u.where}`} className="text-sm">
                    <Link
                      href={u.href as Route}
                      className="font-medium underline underline-offset-4"
                    >
                      {u.label}
                    </Link>{' '}
                    <span className="text-muted-foreground">{u.where}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {can.edit ? (
            <section aria-labelledby="replace" className="space-y-2">
              <h3 id="replace" className="text-sm font-semibold">
                Replace the file
              </h3>
              <p className="text-sm text-muted-foreground">
                Every page that uses this {item.kind === 'image' ? 'photo' : 'document'} will show
                the new one. Its description stays.
              </p>
              <label
                className={cn(
                  buttonVariants({ variant: 'outline' }),
                  'cursor-pointer focus-within:outline-3 focus-within:outline-offset-2',
                  (!hydrated || replacing) && 'pointer-events-none opacity-60',
                )}
              >
                <input
                  type="file"
                  className="sr-only"
                  accept={
                    item.kind === 'image'
                      ? 'image/jpeg,image/png,image/webp,image/gif,image/avif'
                      : 'application/pdf'
                  }
                  disabled={!hydrated || replacing !== null}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) replace(file);
                  }}
                />
                <RefreshCw aria-hidden="true" />
                {replacing ?? `Replace with another ${item.kind === 'image' ? 'photo' : 'PDF'}`}
              </label>
            </section>
          ) : null}

          {can.delete ? (
            <section aria-labelledby="remove" className="space-y-2 border-t pt-4">
              <h3 id="remove" className="text-sm font-semibold">
                Remove from the library
              </h3>
              {inUse ? (
                <p className="text-sm text-muted-foreground">
                  This file is used on the website, so it can’t be moved to Trash. Replace it
                  instead, or remove it from those pages first.
                </p>
              ) : (
                <ConfirmDialog
                  trigger={
                    <Button variant="outline" disabled={!hydrated || usages === null}>
                      <Trash2 aria-hidden="true" />
                      Move to Trash
                    </Button>
                  }
                  title={`Move ‘${item.filename}’ to Trash?`}
                  description="You can restore it from Trash for 30 days."
                  confirmLabel="Move to Trash"
                  destructive
                  onConfirm={() =>
                    new Promise<void>((resolve) =>
                      start(async () => {
                        const r = await trashMedia({ id: item.id, version: item.version });
                        if (r.ok) {
                          onRemoved(item.id);
                          toast.success(
                            'Moved to Trash',
                            'You can restore it from Trash for 30 days.',
                          );
                        } else toast.error('Not moved to Trash', r.error.message);
                        resolve();
                      }),
                    )
                  }
                />
              )}
            </section>
          ) : null}

          <a
            href={item.url}
            className="inline-flex items-center gap-1 text-sm underline underline-offset-4"
          >
            Open the file
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        </div>
      </SheetContent>
    </Sheet>
  );
}
