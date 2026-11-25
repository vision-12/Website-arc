import { fill } from '@/lib/i18n/format';
import { t } from '@/lib/i18n/t';
import type { ShellData } from '../types';
import { Container } from '../shared/ui/container';
import { ContactList, OpeningHours, SocialLinks } from '../shared/ui/footer-parts';
import { SmartLink } from '../shared/ui/smart-link';

/** A warm dark close with rounded top corners: who we are, links, how to reach us, when we're open. */
export function CommunityFooter({ shell }: { shell: ShellData }) {
  return (
    <div className="bg-tpl-bg">
      <footer className="rounded-t-tpl-lg bg-tpl-band text-tpl-band-ink">
        <Container className="py-16 lg:py-20">
          <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="font-tpl-heading text-2xl font-bold tracking-[-0.015em]">
                {shell.identity.name}
              </p>
              {shell.footer.blurb ? (
                <p className="mt-4 text-tpl-band-muted">{shell.footer.blurb}</p>
              ) : null}
            </div>
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
            <div className="space-y-8">
              <ContactList shell={shell} className="text-tpl-band-muted" />
              <OpeningHours shell={shell} className="tpl-small text-tpl-band-muted" />
            </div>
          </div>
          <div className="tpl-small mt-14 flex flex-col gap-4 border-t border-white/15 pt-6 text-tpl-band-muted sm:flex-row sm:items-center sm:justify-between">
            <p>
              {fill(t('site.copyright'), { year: shell.year, name: shell.footer.copyrightName })}
            </p>
            <SocialLinks shell={shell} />
            {shell.attribution.showAltrastateCredit ? <p>{t('site.credit')}</p> : null}
          </div>
        </Container>
      </footer>
    </div>
  );
}
