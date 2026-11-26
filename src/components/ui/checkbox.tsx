import { cn } from '@/lib/utils';

/** A native checkbox with a 24 px target (WCAG 2.5.8). */
export function Checkbox({ className, ...props }: Omit<React.ComponentProps<'input'>, 'type'>) {
  return (
    <input
      type="checkbox"
      data-slot="checkbox"
      className={cn('size-5 shrink-0 rounded border-input accent-primary', className)}
      {...props}
    />
  );
}
