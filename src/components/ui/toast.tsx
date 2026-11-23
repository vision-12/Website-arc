'use client';
import { useSyncExternalStore } from 'react';
import { Toast as ToastPrimitive } from 'radix-ui';
import { CheckCircle2, CircleAlert, Info, XIcon } from 'lucide-react';
import { t } from '@/lib/i18n/t';
import { cn } from '@/lib/utils';

/**
 * Minimal toast system on Radix Toast (announced via an aria-live region, MP §11).
 * Replaces sonner, which injects an un-nonced <style> element that the CSP blocks.
 */
type Kind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: Kind;
  title: string;
  description?: string;
}

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function push(kind: Kind, title: string, description?: string) {
  items = [...items, { id: nextId++, kind, title, ...(description ? { description } : {}) }];
  emit();
}
function dismiss(id: number) {
  items = items.filter((i) => i.id !== id);
  emit();
}

export const toast = {
  success: (title: string, description?: string) => push('success', title, description),
  error: (title: string, description?: string) => push('error', title, description),
  info: (title: string, description?: string) => push('info', title, description),
};

const ICON = { success: CheckCircle2, error: CircleAlert, info: Info } as const;

export function Toaster() {
  const list = useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    () => items,
    () => items,
  );
  return (
    <ToastPrimitive.Provider swipeDirection="right" duration={6000}>
      {list.map(({ id, kind, title, description }) => {
        const Icon = ICON[kind];
        return (
          <ToastPrimitive.Root
            key={id}
            type={kind === 'error' ? 'foreground' : 'background'}
            onOpenChange={(open) => !open && dismiss(id)}
            className={cn(
              'flex items-start gap-3 rounded-lg border bg-card p-4 text-card-foreground shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
              kind === 'error' && 'border-destructive',
            )}
          >
            <Icon
              className={cn(
                'mt-0.5 size-5 shrink-0',
                kind === 'error'
                  ? 'text-destructive'
                  : kind === 'success'
                    ? 'text-success'
                    : 'text-muted-foreground',
              )}
              aria-hidden="true"
            />
            <div className="flex-1 space-y-1">
              <ToastPrimitive.Title className="text-sm font-semibold">{title}</ToastPrimitive.Title>
              {description ? (
                <ToastPrimitive.Description className="text-sm text-muted-foreground">
                  {description}
                </ToastPrimitive.Description>
              ) : null}
            </div>
            <ToastPrimitive.Close
              className="inline-flex size-8 items-center justify-center rounded-md hover:bg-accent"
              aria-label={t('common.close')}
            >
              <XIcon className="size-4" aria-hidden="true" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        );
      })}
      <ToastPrimitive.Viewport className="fixed top-4 left-1/2 z-[100] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2 outline-none" />
    </ToastPrimitive.Provider>
  );
}
