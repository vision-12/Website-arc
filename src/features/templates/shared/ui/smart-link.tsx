import type { ReactNode } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { isExternalHref } from '@/lib/rich-text/safe-href';

/**
 * Link for hrefs that come from school content (menus, buttons). Site paths use client-side
 * navigation; external links get rel="noopener noreferrer" and open in the same tab.
 */
export function SmartLink({
  href,
  className,
  children,
  ...rest
}: {
  href: string;
  className?: string | undefined;
  children: ReactNode;
  'aria-current'?: 'page' | undefined;
  'aria-label'?: string | undefined;
}) {
  if (isExternalHref(href) || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return (
      <a href={href} rel="noopener noreferrer" className={className} {...rest}>
        {children}
      </a>
    );
  }
  // Content-defined paths are validated when saved (site path or https); typed routes can't know them.
  return (
    <Link href={href as Route} className={className} {...rest}>
      {children}
    </Link>
  );
}
