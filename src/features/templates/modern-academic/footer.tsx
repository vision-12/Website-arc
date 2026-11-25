import { fill } from '@/lib/i18n/format';
import { t } from '@/lib/i18n/t';
import type { ShellData } from '../types';
import { Container } from '../shared/ui/container';
import { ContactList, OpeningHours, SocialLinks } from '../shared/ui/footer-parts';
import { SmartLink } from '../shared/ui/smart-link';

/** Near-black close: the school's name set large, then contacts, link columns and hours. */
export function ModernFooter({ shell }: { shell: ShellData }) {
  return (
    <footer className="bg-tpl-band text-tpl-band-ink">
      <Container className="py-20 lg:py-24">
        <p className="font-tpl-heading text-[clamp(2.5rem,1rem+6vw,6rem)] leading-[0.95] font-semibold tracking-[-0.045em]">
          {shell.identity.name}
        </p>
        <div className="mt-16 grid gap-12 border-t border-white/15 pt-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            {shell.footer.blurb ? (
              <p className="mb-6 max-w-xs text-tpl-band-muted">{shell.footer.blurb}</p>
            ) : null}
            <ContactList shell={shell} className="text-tpl-band-muted" />
          </div>
          {shell.footer.columns.length > 0 ? (
            <nav aria-label={t('site.footerNav')} className="contents">
              {shell.footer.columns.map((column) => (
                <div key={column.heading}>
                  <h2 className="tpl-label text-tpl-band-ink">{column.heading}</h2>
                  <ul className="mt-4 space-y-1">
                    {column.links.map((link) => (
                      <li key={link.href}>
                        <SmartLink
                          href={link.href}
                          className="inline-flex min-h-11 items-center text-tpl-band-muted hover:text-tpl-band-ink"
                        >
                          <span className="tpl-navword">{link.label}</span>
                        </SmartLink>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          ) : null}
          {shell.contact.hours.length > 0 ? (
            <div>
              <h2 className="tpl-label">{t('site.hours')}</h2>
              <OpeningHours shell={shell} className="tpl-small mt-4 text-tpl-band-muted" />
            </div>
          ) : null}
        </div>
        <div className="tpl-small mt-16 flex flex-col gap-4 border-t border-white/15 pt-6 text-tpl-band-muted sm:flex-row sm:items-center sm:justify-between">
          <p>{fill(t('site.copyright'), { year: shell.year, name: shell.footer.copyrightName })}</p>
          <SocialLinks shell={shell} />
          {shell.attribution.showAltrastateCredit ? <p>{t('site.credit')}</p> : null}
        </div>
      </Container>
    </footer>
  );
}
