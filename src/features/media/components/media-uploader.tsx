'use client';
import { useCallback, useRef, useState } from 'react';
import { CheckCircle2, CircleAlert, Loader2, RotateCcw, UploadCloud, X } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { useHydrated } from '@/hooks/use-hydrated';
import { cn } from '@/lib/utils';
import type { MediaItem } from '../schema';
import { uploadErrorMessage, uploadToLibrary, type UploadStage } from './upload-client';

interface Row {
  key: string;
  file: File;
  stage: UploadStage;
  progress: number;
  error?: string | undefined;
}

const ACCEPT = {
  // HEIC is left out on purpose: iPhones then convert photos to JPEG themselves when uploading.
  images: 'image/jpeg,image/png,image/webp,image/gif,image/avif',
  documents: 'application/pdf',
  any: 'image/jpeg,image/png,image/webp,image/gif,image/avif,application/pdf',
} as const;

const STAGE_TEXT: Record<Exclude<UploadStage, 'error'>, string> = {
  preparing: 'Getting the file ready…',
  uploading: 'Uploading',
  checking: 'Checking the file…',
  done: 'Added to the library',
};

/**
 * Drag-drop or tap to upload (MP §11): files are prepared on the device, uploaded one at a time
 * (kinder to an intermittent connection) with a progress bar, and checked by the server. Plain
 * errors, with a retry, for anything that goes wrong.
 */
export function MediaUploader({
  accept = 'any',
  onUploaded,
  compact = false,
}: {
  accept?: keyof typeof ACCEPT;
  onUploaded: (item: MediaItem) => void;
  compact?: boolean;
}) {
  const hydrated = useHydrated();
  const [rows, setRows] = useState<Row[]>([]);
  const [dragging, setDragging] = useState(false);
  const queue = useRef<Row[]>([]);
  const running = useRef(false);

  const update = (key: string, patch: Partial<Row>) =>
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const drain = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    for (let next = queue.current.shift(); next; next = queue.current.shift()) {
      const { key, file } = next;
      try {
        const item = await uploadToLibrary(file, (stage, p) =>
          update(key, { stage, ...(p !== undefined ? { progress: Math.round(p * 100) } : {}) }),
        );
        update(key, { stage: 'done', progress: 100 });
        onUploaded(item);
      } catch (e) {
        update(key, { stage: 'error', error: uploadErrorMessage(e) });
      }
    }
    running.current = false;
  }, [onUploaded]);

  const add = (files: Iterable<File>) => {
    const added: Row[] = [...files].map((file) => ({
      key: crypto.randomUUID(),
      file,
      stage: 'preparing',
      progress: 0,
    }));
    if (added.length === 0) return;
    setRows((list) => [...list.filter((r) => r.stage !== 'done'), ...added]);
    queue.current.push(...added);
    void drain();
  };

  const retry = (row: Row) => {
    update(row.key, { stage: 'preparing', progress: 0, error: undefined });
    queue.current.push(row);
    void drain();
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          add(e.dataTransfer.files);
        }}
        className={cn(
          'flex flex-col items-center gap-2 rounded-xl border-2 border-dashed bg-card text-center',
          compact ? 'px-4 py-4' : 'px-6 py-8',
          dragging && 'border-primary bg-accent',
        )}
      >
        {compact ? null : (
          <UploadCloud className="size-8 text-muted-foreground" aria-hidden="true" />
        )}
        <p className="text-sm text-muted-foreground">
          {accept === 'documents' ? 'Drag a PDF here, or' : 'Drag photos here, or'}
        </p>
        <label
          className={cn(
            buttonVariants({ variant: 'default' }),
            'cursor-pointer focus-within:outline-3 focus-within:outline-offset-2',
            !hydrated && 'pointer-events-none opacity-60',
          )}
        >
          <input
            type="file"
            multiple
            accept={ACCEPT[accept]}
            disabled={!hydrated}
            className="sr-only"
            onChange={(e) => {
              if (e.target.files) add(e.target.files);
              e.target.value = '';
            }}
          />
          {accept === 'documents' ? 'Choose a PDF' : 'Choose files'}
        </label>
        <p className="max-w-prose text-xs text-muted-foreground">
          Photos are made smaller on this device before they are sent, to save data. Photos up to 10
          MB, PDFs up to 20 MB.
        </p>
      </div>

      {rows.length > 0 ? (
        <ul className="space-y-2" aria-label="Uploads">
          {rows.map((row) => (
            <li key={row.key} className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-2">
                {row.stage === 'done' ? (
                  <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" />
                ) : row.stage === 'error' ? (
                  <CircleAlert className="size-4 shrink-0 text-destructive" aria-hidden="true" />
                ) : (
                  <Loader2
                    className="size-4 shrink-0 animate-spin text-muted-foreground"
                    aria-hidden="true"
                  />
                )}
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.file.name}</span>
                {row.stage === 'error' ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => retry(row)}>
                      <RotateCcw aria-hidden="true" />
                      Try again
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setRows((l) => l.filter((r) => r.key !== row.key))}
                    >
                      <X aria-hidden="true" />
                      <span className="sr-only">Remove {row.file.name} from the list</span>
                    </Button>
                  </>
                ) : null}
              </div>
              <p
                className={cn(
                  'mt-1 text-sm',
                  row.stage === 'error' ? 'font-medium text-destructive' : 'text-muted-foreground',
                )}
                aria-live="polite"
              >
                {row.stage === 'error'
                  ? row.error
                  : row.stage === 'uploading'
                    ? `${STAGE_TEXT.uploading} ${row.progress}%`
                    : STAGE_TEXT[row.stage]}
              </p>
              {row.stage === 'uploading' ? (
                <div
                  role="progressbar"
                  aria-label={`Uploading ${row.file.name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={row.progress}
                  className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="h-full bg-primary transition-[width]"
                    style={{ width: `${row.progress}%` }}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
