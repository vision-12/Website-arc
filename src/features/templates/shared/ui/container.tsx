import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const WIDTHS = { narrow: 'max-w-3xl', default: 'max-w-6xl', wide: 'max-w-7xl' } as const;

export function Container({
  size = 'default',
  className,
  children,
}: {
  size?: keyof typeof WIDTHS;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('mx-auto w-full px-4 sm:px-6 lg:px-8', WIDTHS[size], className)}>
      {children}
    </div>
  );
}
