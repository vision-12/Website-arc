import { fill } from '@/lib/i18n/format';
import { t } from '@/lib/i18n/t';
import type { ShellData } from '../types';
import { Container } from '../shared/ui/container';
import { ContactList, OpeningHours, SocialLinks } from '../shared/ui/footer-parts';
import { SmartLink } from '../shared/ui/smart-link';

/** A warm "visit us" close: the name and motto centred, then visiting details beside the links. */
export function HeritageFooter({ shell }: { shell: ShellData }) {
  return (
    <footer className="bg-tpl-band text-tpl-band-ink">
      <Container className="py-20">
        <div className="text-center">
          <p className="font-tpl-heading text-3xl font-medium sm:text-4xl">{shell.identity.name}</p>
          {shell.identity.motto ? (
            <p className="mt-2 font-tpl-heading text-tpl-band-muted italic">
              {shell.identity.motto}
            </p>
          ) : null}
          <span aria-hidden="true" className="mx-auto mt-8 block h-px w-16 bg-tpl-band-ink/40" />
        </div>
        <div className="mt-14 grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <h2 className="font-tpl-heading text-xl">{t('site.visit')}</h2>
            <div className="mt-5 grid gap-8 sm:grid-cols-2">
              <ContactList shell={shell} className="text-tpl-band-muted" />
              <OpeningHours shell={shell} className="tpl-small text-tpl-band-muted" />
            </div>
          </div>
          {shell.footer.columns.length > 0 ? (
            <nav aria-label={t('site.footerNav')} className="contents">
              {shell.footer.columns.map((column) => (
                <div key={column.heading}>
                  <h2 className="font-tpl-heading text-xl">{column.heading}</h2>
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
