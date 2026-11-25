'use client';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { SmartLink } from './smart-link';

/** Navigation link that tells assistive technology which page you are on (wayfinding). */
export function NavLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const current =
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <SmartLink
      href={href}
      className={className}
      {...(current ? { 'aria-current': 'page' as const } : {})}
    >
      {children}
    </SmartLink>
  );
}
