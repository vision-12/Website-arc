import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n/t';
import type { Crumb } from '../../types';
import { SmartLink } from './smart-link';

/** Where am I: the path to this page, the current page last and marked as such. */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label={t('site.breadcrumb')} className={cn('tpl-small', className)}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {items.map((crumb, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${crumb.label}-${i}`} className="flex items-center gap-1.5">
              {crumb.href && !last ? (
                <SmartLink
                  href={crumb.href}
                  className="tpl-navword inline-flex min-h-6 items-center text-tpl-ink-muted hover:text-tpl-ink"
                >
                  {crumb.label}
                </SmartLink>
              ) : (
                <span aria-current={last ? 'page' : undefined} className="font-semibold">
                  {crumb.label}
                </span>
              )}
              {last ? null : (
                <ChevronRight aria-hidden="true" className="size-3.5 text-tpl-ink-muted" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
