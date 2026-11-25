import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { ShellData } from '../../types';
import { Picture } from './picture';

/**
 * The school's logo and name, linking home. Without an uploaded logo the name is set as a
 * wordmark in the heading face; nothing is drawn in place of a crest. The link is named by what it
 * shows (WCAG 2.5.3, label in name): the visible name, or the logo's alt text when the name is
 * hidden.
 */
export function Brand({
  shell,
  className,
  logoClassName,
  nameClassName,
  showName = true,
  showMotto = false,
}: {
  shell: ShellData;
  className?: string;
  logoClassName?: string;
  nameClassName?: string;
  showName?: boolean;
  showMotto?: boolean;
}) {
  const { identity } = shell;
  return (
    <Link href="/" className={cn('inline-flex min-h-11 items-center gap-3', className)}>
      {identity.logo ? (
        <Picture
          image={{ ...identity.logo, alt: showName ? '' : identity.name }}
          sizes="64px"
          priority
          className={cn('h-11 w-auto', logoClassName)}
        />
      ) : null}
      {showName || !identity.logo ? (
        <span className="flex flex-col">
          <span className={cn('font-tpl-heading leading-tight', nameClassName)}>
            {identity.name}
          </span>
          {showMotto && identity.motto ? (
            <span className="tpl-small mt-0.5 opacity-80">{identity.motto}</span>
          ) : null}
        </span>
      ) : null}
    </Link>
  );
}
