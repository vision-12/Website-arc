import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/** A native <select>: works with every keyboard, screen reader and old Android tablet (MP §11). */
export function NativeSelect({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select
        data-slot="select"
        className={cn(
          'flex h-10 w-full appearance-none rounded-md border border-input bg-card py-2 pr-9 pl-3 text-base disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive md:text-sm',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
    </div>
  );
}
