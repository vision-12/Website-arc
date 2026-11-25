import { fill } from '@/lib/i18n/format';
import { t } from '@/lib/i18n/t';
import type { ShellData } from '../types';
import { Brand } from '../shared/ui/brand';
import { ButtonLink } from '../shared/ui/button-link';
import { Container } from '../shared/ui/container';
import { DesktopNav, MobileMenu } from '../shared/ui/nav';

/** A quiet founding line, then the serif wordmark with the navigation set in the heading face. */
export function HeritageHeader({ shell }: { shell: ShellData }) {
  const apply = shell.admissionsEnabled ? { label: t('site.apply'), href: '/admissions' } : null;
  const { foundedYear, motto } = shell.identity;
  const line = foundedYear ? fill(t('site.founded'), { year: foundedYear }) : motto;
  return (
    <>
      {line ? (
        <div className="hidden border-b border-tpl-rule bg-tpl-bg lg:block">
          <Container className="flex min-h-10 items-center justify-center gap-4 font-tpl-heading text-[0.9375rem] text-tpl-ink-muted italic">
            <span aria-hidden="true" className="h-px w-10 bg-tpl-rule-strong" />
            <p>{line}</p>
            <span aria-hidden="true" className="h-px w-10 bg-tpl-rule-strong" />
          </Container>
        </div>
      ) : null}
      <header className="tpl-material tpl-scroll-edge sticky top-0 z-30 border-b border-tpl-rule">
        <Container className="flex min-h-[var(--tpl-header-h)] items-center justify-between gap-8">
          <Brand
            shell={shell}
            nameClassName="text-[1.375rem] font-medium tracking-[-0.01em] sm:text-2xl"
          />
          <div className="flex items-center gap-7">
            <DesktopNav
              items={shell.navigation}
              itemClassName="font-tpl-heading text-[1.0625rem]"
            />
            {apply ? (
              <ButtonLink
                link={apply}
                variant="secondary"
                className="hidden min-h-10 py-1.5 lg:inline-flex"
              />
            ) : null}
            <MobileMenu shell={shell} apply={apply} />
          </div>
        </Container>
      </header>
    </>
  );
}
