import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { ShellData } from '../types';
import { Picture } from '../shared/ui/picture';

/** The logo, or a round badge with the school's initial, beside the name. Links home; named by the visible name. */
export function BrandBadge({ shell, className }: { shell: ShellData; className?: string }) {
  const { identity } = shell;
  return (
    <Link href="/" className={cn('inline-flex min-h-11 items-center gap-3', className)}>
      {identity.logo ? (
        <Picture
          image={{ ...identity.logo, alt: '' }}
          sizes="48px"
          priority
          className="h-10 w-auto"
        />
      ) : (
        <span
          aria-hidden="true"
          className="grid size-10 place-items-center rounded-full bg-tpl-brand font-tpl-heading text-lg font-bold text-tpl-brand-ink"
        >
          {(identity.shortName || identity.name).charAt(0)}
        </span>
      )}
      <span className="font-tpl-heading text-lg font-bold tracking-[-0.01em]">{identity.name}</span>
    </Link>
  );
}
