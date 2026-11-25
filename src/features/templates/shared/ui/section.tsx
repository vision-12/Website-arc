import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SmartLink } from './smart-link';

const TONES = {
  plain: 'bg-tpl-bg text-tpl-ink',
  alt: 'bg-tpl-surface-alt text-tpl-ink',
  band: 'bg-tpl-band text-tpl-band-ink',
} as const;
export type SectionTone = keyof typeof TONES;

/** A homepage section: one landmark, named by its visible heading. */
export function SectionFrame({
  id,
  tone = 'plain',
  label,
  named = true,
  className,
  children,
}: {
  id: string;
  tone?: SectionTone;
  /** For a section without a visible heading: names the landmark instead. */
  label?: string | undefined;
  /** False when the section has no heading and needs no landmark name (a plain text block). */
  named?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const name = label ? { 'aria-label': label } : named ? { 'aria-labelledby': `${id}-title` } : {};
  return (
    <section {...name} className={cn('tpl-section', TONES[tone], className)}>
      {children}
    </section>
  );
}

/**
 * Section heading (h2) with an optional link that names what it opens ("See all news"), placed
 * beside the content it leads to.
 */
export function SectionHeading({
  id,
  title,
  action,
  align = 'start',
  tone = 'plain',
  className,
}: {
  id: string;
  title: string;
  action?: { label: string; href: string } | null;
  align?: 'start' | 'center';
  tone?: SectionTone;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mb-10 flex flex-wrap gap-x-8 gap-y-4 sm:mb-12',
        align === 'center' ? 'flex-col items-center text-center' : 'items-end justify-between',
        className,
      )}
    >
      <h2 id={`${id}-title`} className={cn('tpl-h2 max-w-2xl', align === 'center' && 'mx-auto')}>
        {title}
      </h2>
      {action ? <ArrowLink href={action.href} label={action.label} tone={tone} /> : null}
    </div>
  );
}

/** A text link with a trailing arrow: the one secondary-action look shared by every section. */
export function ArrowLink({
  href,
  label,
  tone = 'plain',
  className,
}: {
  href: string;
  label: string;
  tone?: SectionTone;
  className?: string;
}) {
  return (
    <SmartLink
      href={href}
      className={cn(
        'inline-flex min-h-11 items-center gap-1.5 font-semibold',
        tone === 'band' ? 'text-tpl-band-ink' : 'text-tpl-brand-text',
        className,
      )}
    >
      <span className="tpl-navword">{label}</span>
      <ArrowRight aria-hidden="true" className="tpl-arrow size-4" />
    </SmartLink>
  );
}
