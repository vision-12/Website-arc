import { ChevronDown, Mail, Menu, Phone, X } from 'lucide-react';
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
                    'tpl-pop tpl-glass tpl-glass-menu absolute top-full left-0 z-50 mt-2 min-w-60 rounded-tpl-lg p-2 text-tpl-ink [--tpl-pop-origin:top_left]',
                    panelClassName,
                  )}
                >
                  <ul aria-label={fill(t('site.submenu'), { label: item.label })}>
                    {item.href ? (
                      <li>
                        <NavLink
                          href={item.href}
                          className="flex min-h-11 items-center rounded-tpl px-3 hover:bg-tpl-ink/[0.06]"
                        >
                          {item.label}
                        </NavLink>
                      </li>
                    ) : null}
                    {item.children.map((child) => (
                      <li key={child.id}>
                        <NavLink
                          href={child.href}
                          className="flex min-h-11 items-center rounded-tpl px-3 hover:bg-tpl-ink/[0.06]"
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
 *
 * Shaped by the mobile navigation patterns studied on 21st.dev: top-level pages as one scannable
 * list; pages with sub-pages expand in place (native <details>, so they work before JavaScript
 * and announce their expanded state); the main action and the ways to reach the school stay
 * pinned at the bottom, where a thumb rests, however long the list grows.
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
  const phone = shell.contact.phones[0]?.number;
  const email = shell.contact.emails[0]?.address;
  const quick =
    'tpl-btn flex min-h-11 items-center justify-center gap-1.5 rounded-tpl px-2 text-[0.8125rem] font-semibold whitespace-nowrap ring-1 ring-tpl-rule-strong';
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
      <div className="tpl-pop fixed inset-x-0 top-[var(--tpl-header-h,4.5rem)] bottom-0 z-40 flex flex-col border-t border-tpl-rule bg-tpl-surface text-tpl-ink [--tpl-pop-origin:top_right]">
        <nav
          aria-label={t('site.mainNav')}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-2 pb-6 sm:px-6"
        >
          <ul className="divide-y divide-tpl-rule">
            {shell.navigation.map((item) =>
              item.children.length > 0 ? (
                <li key={item.id}>
                  <details className="group/sub">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 text-xl font-semibold [&::-webkit-details-marker]:hidden">
                      {item.label}
                      <ChevronDown
                        aria-hidden="true"
                        className="size-5 text-tpl-ink-muted transition-transform duration-200 ease-[var(--tpl-ease)] group-open/sub:rotate-180"
                      />
                    </summary>
                    <ul
                      aria-label={fill(t('site.submenu'), { label: item.label })}
                      className="mb-3 border-l-2 border-tpl-rule pl-4"
                    >
                      {item.href ? (
                        <li>
                          <NavLink
                            href={item.href}
                            className="flex min-h-11 items-center text-tpl-ink-muted aria-[current=page]:font-semibold aria-[current=page]:text-tpl-ink"
                          >
                            {item.label}
                          </NavLink>
                        </li>
                      ) : null}
                      {item.children.map((child) => (
                        <li key={child.id}>
                          <NavLink
                            href={child.href}
                            className="flex min-h-11 items-center text-tpl-ink-muted aria-[current=page]:font-semibold aria-[current=page]:text-tpl-ink"
                          >
                            {child.label}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              ) : item.href ? (
                <li key={item.id}>
                  <NavLink
                    href={item.href}
                    className="flex min-h-14 items-center text-xl font-semibold aria-[current=page]:text-tpl-brand-text"
                  >
                    {item.label}
                  </NavLink>
                </li>
              ) : null,
            )}
          </ul>
        </nav>
        {apply || phone || email ? (
          <div className="border-t border-tpl-rule px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
            {apply ? (
              <NavLink
                href={apply.href}
                className="tpl-btn flex min-h-12 w-full items-center justify-center rounded-tpl bg-tpl-brand px-5 font-semibold text-tpl-brand-ink"
              >
                {apply.label}
              </NavLink>
            ) : null}
            {phone || email ? (
              <div className={cn('grid gap-3', apply && 'mt-3', phone && email && 'grid-cols-2')}>
                {phone ? (
                  <a href={`tel:${phone}`} className={quick}>
                    <Phone aria-hidden="true" className="size-4" />
                    {t('site.callSchool')}
                  </a>
                ) : null}
                {email ? (
                  <a href={`mailto:${email}`} className={quick}>
                    <Mail aria-hidden="true" className="size-4" />
                    {t('site.emailSchool')}
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </details>
  );
}
