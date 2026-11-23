'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { t } from '@/lib/i18n/t';
import { cn } from '@/lib/utils';
import { ADMIN_SECTIONS, type AdminSectionKey } from '../sections';

/**
 * Active-state aware navigation list. Receives only section keys from the server (icons are
 * components and cannot cross the server→client boundary).
 */
export function SidebarNav({
  keys,
  onNavigate,
}: {
  keys: readonly AdminSectionKey[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const sections = ADMIN_SECTIONS.filter((s) => keys.includes(s.key));
  return (
    <ul className="flex flex-col gap-0.5">
      {sections.map(({ key, href, labelKey, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <li key={key}>
            <Link
              href={href}
              {...(onNavigate ? { onClick: onNavigate } : {})}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm text-[var(--admin-sidebar-foreground)] hover:bg-[var(--admin-sidebar-active)]',
                active &&
                  'bg-[var(--admin-sidebar-active)] font-semibold text-white before:absolute before:inset-y-1.5 before:left-0 before:w-1 before:rounded-full before:bg-[var(--admin-indicator)]',
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {t(labelKey)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
