import { CheckCircle2, CloudOff, Loader2 } from 'lucide-react';
import { t } from '@/lib/i18n/t';
import { cn } from '@/lib/utils';

export type SaveState = 'saved' | 'saving' | 'unsaved';

const ICONS = { saved: CheckCircle2, saving: Loader2, unsaved: CloudOff } as const;

/**
 * The three save states every admin form shows (MP §11). Announced politely to screen readers.
 * `announce={false}` draws a visual-only copy (e.g. near the editor on phones) so the state isn't
 * announced twice.
 */
export function SaveStateIndicator({
  state,
  className,
  announce = true,
}: {
  state: SaveState;
  className?: string;
  announce?: boolean;
}) {
  const Icon = ICONS[state];
  return (
    <p
      {...(announce ? { role: 'status', 'aria-live': 'polite' as const } : { 'aria-hidden': true })}
      data-state={state}
      className={cn(
        'inline-flex items-center gap-1.5 text-sm',
        state === 'unsaved' ? 'font-medium text-destructive' : 'text-muted-foreground',
        className,
      )}
    >
      <Icon className={cn('size-4', state === 'saving' && 'animate-spin')} aria-hidden="true" />
      {t(`saveState.${state}`)}
    </p>
  );
}
