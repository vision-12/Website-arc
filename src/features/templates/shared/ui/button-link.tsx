import { cn } from '@/lib/utils';
import type { ResolvedLink } from '../../types';
import { SmartLink } from './smart-link';

/**
 * The template's one button pair: `primary` (filled) and `secondary` (outline). Each template
 * shapes them through its tokens (radius, weight); there is no third button style.
 */
const VARIANTS = {
  primary:
    'bg-tpl-brand text-tpl-brand-ink hover:bg-[color-mix(in_oklab,var(--tpl-brand)_86%,var(--tpl-ink))]',
  secondary:
    'border border-tpl-rule-strong bg-transparent text-tpl-ink hover:border-tpl-ink hover:bg-tpl-surface-alt',
  primaryOnBand:
    'bg-tpl-band-ink text-tpl-band hover:bg-[color-mix(in_oklab,var(--tpl-band-ink)_88%,var(--tpl-band))]',
  secondaryOnBand:
    'border border-tpl-band-ink/50 text-tpl-band-ink hover:border-tpl-band-ink hover:bg-white/10',
} as const;
export type ButtonVariant = keyof typeof VARIANTS;

/** Call-to-action link styled as a button; at least 44 px tall, a comfortable touch target. */
export function ButtonLink({
  link,
  variant = 'primary',
  className,
}: {
  link: Pick<ResolvedLink, 'label' | 'href'>;
  variant?: ButtonVariant;
  className?: string;
}) {
  return (
    <SmartLink
      href={link.href}
      className={cn(
        'tpl-btn inline-flex min-h-11 items-center justify-center rounded-tpl px-5 py-2.5 text-center font-semibold',
        VARIANTS[variant],
        className,
      )}
    >
      {link.label}
    </SmartLink>
  );
}
