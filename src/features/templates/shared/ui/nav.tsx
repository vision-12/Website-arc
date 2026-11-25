import { ChevronDown, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fill } from '@/lib/i18n/format';
import { t } from '@/lib/i18n/t';
import type { ResolvedNavItem, ShellData } from '../../types';
import { NavLink } from './nav-link';

/**
 * Desktop navigation: words that draw an underline, a 2px bar under the current page, and native
 * <details> dropdowns for sub-pages (they work before JavaScript; MenuEnhancer adds Escape and
 * outside-click closing). Dropdowns open from their own word (transform-origin there).
 */
export function DesktopNav({
  items,
  className,
  itemClassName,
  panelClassName,
}: {
  items: ResolvedNavItem[];
  className?: string;
  itemClassName?: string;
  panelClassName?: string;
}) {
  if (items.length === 0) return null;
  return (
    <nav aria-label={t('site.mainNav')} className={cn('hidden lg:block', className)}>
      <ul className="flex items-center gap-x-7">
        {items.map((item) =>
          item.children.length > 0 ? (
            <li key={item.id}>
              <details data-tpl-menu className="group relative">
                <summary
                  className={cn(
                    'flex min-h-11 cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden',
                    itemClassName,
                  )}
                >
                  <span className="tpl-navword">{item.label}</span>
                  <ChevronDown aria-hidden="true" className="size-4 group-open:rotate-180" />
                </summary>
                <div
                  className={cn(
                    'tpl-pop absolute top-full left-0 z-50 mt-2 min-w-60 rounded-tpl border border-tpl-rule bg-tpl-surface p-2 text-tpl-ink shadow-[0_16px_40px_-20px_rgb(0_0_0/0.3)] [--tpl-pop-origin:top_left]',
                    panelClassName,
                  )}
                >
                  <ul aria-label={fill(t('site.submenu'), { label: item.label })}>
                    {item.href ? (
                      <li>
                        <NavLink
                          href={item.href}
                          className="flex min-h-11 items-center rounded-tpl px-3 hover:bg-tpl-surface-alt"
                        >
                          {item.label}
                        </NavLink>
                      </li>
                    ) : null}
                    {item.children.map((child) => (
                      <li key={child.id}>
                        <NavLink
                          href={child.href}
                          className="flex min-h-11 items-center rounded-tpl px-3 hover:bg-tpl-surface-alt"
                        >
                          {child.label}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            </li>
          ) : item.href ? (
            <li key={item.id}>
              <NavLink href={item.href} className={cn('flex min-h-11 items-center', itemClassName)}>
                <span className="tpl-navword">{item.label}</span>
              </NavLink>
            </li>
          ) : null,
        )}
      </ul>
    </nav>
  );
}

/**
 * Phone and tablet menu: a full-screen panel under the header, opened by a button that shows its
 * state (Menu / Close). The page behind doesn't scroll while it is open (CSS :has, no script).
 */
export function MobileMenu({
  shell,
  apply,
  className,
  buttonClassName,
}: {
  shell: ShellData;
  apply?: { label: string; href: string } | null;
  className?: string;
  buttonClassName?: string;
}) {
  if (shell.navigation.length === 0 && !apply) return null;
  return (
    <details data-tpl-menu="mobile" className={cn('group lg:hidden', className)}>
      <summary
        className={cn(
          'tpl-btn flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-tpl px-3 font-semibold [&::-webkit-details-marker]:hidden',
          buttonClassName,
        )}
      >
        <Menu aria-hidden="true" className="size-5 group-open:hidden" />
        <X aria-hidden="true" className="hidden size-5 group-open:block" />
        <span className="group-open:hidden">{t('site.menu')}</span>
        <span className="hidden group-open:inline">{t('site.closeMenu')}</span>
      </summary>
      <div className="tpl-pop fixed inset-x-0 top-[var(--tpl-header-h,4.5rem)] bottom-0 z-40 overflow-y-auto overscroll-contain border-t border-tpl-rule bg-tpl-surface px-4 pt-4 pb-10 text-tpl-ink [--tpl-pop-origin:top_right] sm:px-6">
        <nav aria-label={t('site.mainNav')}>
          <ul className="divide-y divide-tpl-rule">
            {shell.navigation.map((item) => (
              <li key={item.id} className="py-2">
                {item.href ? (
                  <NavLink
                    href={item.href}
                    className="flex min-h-12 items-center text-xl font-semibold"
                  >
                    {item.label}
                  </NavLink>
                ) : (
                  <p className="flex min-h-12 items-center text-xl font-semibold">{item.label}</p>
                )}
                {item.children.length > 0 ? (
                  <ul className="mb-2 grid gap-x-6 sm:grid-cols-2">
                    {item.children.map((child) => (
                      <li key={child.id}>
                        <NavLink
                          href={child.href}
                          className="flex min-h-11 items-center text-tpl-ink-muted"
                        >
                          {child.label}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </nav>
        {apply ? (
          <NavLink
            href={apply.href}
            className="tpl-btn mt-8 flex min-h-12 w-full items-center justify-center rounded-tpl bg-tpl-brand px-5 font-semibold text-tpl-brand-ink"
          >
            {apply.label}
          </NavLink>
        ) : null}
      </div>
    </details>
  );
}
