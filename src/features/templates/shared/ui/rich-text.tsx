import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function RichText({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('tpl-prose', className)}>{children}</div>;
}
