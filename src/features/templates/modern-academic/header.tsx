import { t } from '@/lib/i18n/t';
import type { ShellData } from '../types';
import { Brand } from '../shared/ui/brand';
import { ButtonLink } from '../shared/ui/button-link';
import { Container } from '../shared/ui/container';
import { DesktopNav, MobileMenu } from '../shared/ui/nav';

/** One slim translucent bar: the school's name on the left, navigation and Apply on the right. */
export function ModernHeader({ shell }: { shell: ShellData }) {
  const apply = shell.admissionsEnabled ? { label: t('site.apply'), href: '/admissions' } : null;
  return (
    <header className="tpl-material tpl-scroll-edge sticky top-0 z-30">
      <Container className="flex min-h-[var(--tpl-header-h)] items-center justify-between gap-8">
        <Brand shell={shell} nameClassName="text-lg font-semibold tracking-[-0.015em]" />
        <div className="flex items-center gap-7">
          <DesktopNav items={shell.navigation} itemClassName="text-[0.9375rem] font-medium" />
          {apply ? (
            <ButtonLink link={apply} className="hidden min-h-10 py-1.5 lg:inline-flex" />
          ) : null}
          <MobileMenu shell={shell} apply={apply} />
        </div>
      </Container>
    </header>
  );
}
