import { Mail, MapPin, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n/t';
import type { ShellData } from '../../types';
import { SmartLink } from './smart-link';

const NETWORK_LABELS: Record<ShellData['social'][number]['network'], string> = {
  facebook: 'Facebook',
  x: 'X',
  instagram: 'Instagram',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  whatsapp: 'WhatsApp',
};

/** Phone numbers, email addresses and the address: real links, labelled for screen readers. */
export function ContactList({ shell, className }: { shell: ShellData; className?: string }) {
  const { contact } = shell;
  return (
    <ul className={cn('space-y-3', className)}>
      {contact.address ? (
        <li className="flex gap-3">
          <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 opacity-70" />
          <span>
            <span className="sr-only">{t('site.address')}: </span>
            {contact.address}
          </span>
        </li>
      ) : null}
      {contact.phones.map((phone) => (
        <li key={phone.number} className="flex gap-3">
          <Phone aria-hidden="true" className="mt-1 size-4 shrink-0 opacity-70" />
          <SmartLink href={`tel:${phone.number}`} className="tpl-navword min-h-6">
            <span className="sr-only">{phone.label || t('site.phone')}: </span>
            {formatPhone(phone.number)}
          </SmartLink>
        </li>
      ))}
      {contact.emails.map((email) => (
        <li key={email.address} className="flex gap-3">
          <Mail aria-hidden="true" className="mt-1 size-4 shrink-0 opacity-70" />
          <SmartLink href={`mailto:${email.address}`} className="tpl-navword min-h-6 break-all">
            <span className="sr-only">{email.label || t('site.email')}: </span>
            {email.address}
          </SmartLink>
        </li>
      ))}
    </ul>
  );
}

/** Opening hours as a definition list (days → times). */
export function OpeningHours({ shell, className }: { shell: ShellData; className?: string }) {
  if (shell.contact.hours.length === 0) return null;
  return (
    <dl className={cn('space-y-3', className)}>
      {shell.contact.hours.map((row) => (
        <div key={row.days}>
          <dt className="font-semibold">{row.days}</dt>
          <dd className="opacity-80">{row.times}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Social profiles as named text links: clearer than unlabelled brand glyphs. */
export function SocialLinks({ shell, className }: { shell: ShellData; className?: string }) {
  if (shell.social.length === 0) return null;
  return (
    <ul aria-label={t('site.followUs')} className={cn('flex flex-wrap gap-x-5 gap-y-2', className)}>
      {shell.social.map((link) => (
        <li key={link.url}>
          <SmartLink href={link.url} className="inline-flex min-h-11 items-center">
            <span className="tpl-navword">{NETWORK_LABELS[link.network]}</span>
          </SmartLink>
        </li>
      ))}
    </ul>
  );
}

/** "+256700123456" → "+256 700 123 456" for reading; the link keeps the dialable form. */
export function formatPhone(e164: string): string {
  const match = /^\+(\d{3})(\d{3})(\d{3})(\d{3,})$/.exec(e164);
  return match ? `+${match[1]} ${match[2]} ${match[3]} ${match[4]}` : e164;
}
