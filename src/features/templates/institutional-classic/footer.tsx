import { t } from '@/lib/i18n/t';
import { fill } from '@/lib/i18n/format';
import type { ShellData } from '../types';
import { Brand } from '../shared/ui/brand';
import { ContactList, OpeningHours, SocialLinks } from '../shared/ui/footer-parts';
import { SmartLink } from '../shared/ui/smart-link';

/** Columns on the deep brand band: identity and contacts, the school's link columns, hours. */
export function InstitutionalFooter({ shell }: { shell: ShellData }) {
  return (
    <footer className="bg-tpl-band text-tpl-band-ink">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-[5fr_7fr] lg:gap-16">
          <div>
            <Brand shell={shell} showMotto nameClassName="text-2xl font-semibold" />
            {shell.footer.blurb ? (
              <p className="mt-5 max-w-sm text-tpl-band-muted">{shell.footer.blurb}</p>
            ) : null}
            <ContactList shell={shell} className="mt-8 text-tpl-band-muted" />
          </div>
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {shell.footer.columns.length > 0 ? (
              <nav aria-label={t('site.footerNav')} className="contents">
                {shell.footer.columns.map((column) => (
                  <div key={column.heading}>
                    <h2 className="tpl-label">{column.heading}</h2>
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
                <OpeningHours shell={shell} className="tpl-small mt-4" />
              </div>
            ) : null}
          </div>
        </div>
        <div className="tpl-small mt-14 flex flex-col gap-4 border-t border-white/20 pt-6 text-tpl-band-muted sm:flex-row sm:items-center sm:justify-between">
          <p>{fill(t('site.copyright'), { year: shell.year, name: shell.footer.copyrightName })}</p>
          <SocialLinks shell={shell} />
          {shell.attribution.showAltrastateCredit ? <p>{t('site.credit')}</p> : null}
        </div>
      </div>
    </footer>
  );
}
