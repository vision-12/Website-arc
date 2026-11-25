import { t } from '@/lib/i18n/t';
import type { ShellData } from '../types';
import { Brand } from '../shared/ui/brand';
import { ButtonLink } from '../shared/ui/button-link';
import { Container } from '../shared/ui/container';
import { formatPhone } from '../shared/ui/footer-parts';
import { DesktopNav, MobileMenu } from '../shared/ui/nav';
import { SmartLink } from '../shared/ui/smart-link';

/**
 * Formal top bar with contacts, the crest centred with the school's name and motto, and a
 * full-width navigation bar that stays at the top as a translucent layer.
 */
export function InstitutionalHeader({ shell }: { shell: ShellData }) {
  const apply = shell.admissionsEnabled ? { label: t('site.apply'), href: '/admissions' } : null;
  const phone = shell.contact.phones[0];
  const email = shell.contact.emails[0];
  return (
    <>
      <div className="hidden bg-tpl-band text-tpl-band-ink lg:block">
        <Container className="tpl-small flex min-h-10 items-center justify-between gap-6">
          <p className="truncate text-tpl-band-muted">{shell.contact.address}</p>
          <ul className="flex shrink-0 items-center gap-6">
            {phone ? (
              <li>
                <SmartLink href={`tel:${phone.number}`} className="tpl-navword">
                  {formatPhone(phone.number)}
                </SmartLink>
              </li>
            ) : null}
            {email ? (
              <li>
                <SmartLink href={`mailto:${email.address}`} className="tpl-navword">
                  {email.address}
                </SmartLink>
              </li>
            ) : null}
          </ul>
        </Container>
      </div>
      <div className="hidden border-b border-tpl-rule bg-tpl-surface lg:block">
        <Container className="flex justify-center py-7 text-center">
          <Brand
            shell={shell}
            showMotto
            className="flex-col gap-3"
            logoClassName="h-16"
            nameClassName="text-[1.75rem] font-semibold tracking-[-0.01em]"
          />
        </Container>
      </div>
      <header className="tpl-material tpl-scroll-edge sticky top-0 z-30 border-b border-tpl-rule">
        <Container className="flex min-h-[var(--tpl-header-h)] items-center justify-between gap-6 lg:min-h-14 lg:justify-center">
          <Brand shell={shell} className="lg:hidden" nameClassName="text-lg font-semibold" />
          <DesktopNav items={shell.navigation} itemClassName="text-[0.95rem] font-medium" />
          {apply ? (
            <ButtonLink link={apply} className="ml-2 hidden min-h-10 py-1.5 lg:inline-flex" />
          ) : null}
          <MobileMenu shell={shell} apply={apply} />
        </Container>
      </header>
    </>
  );
}
