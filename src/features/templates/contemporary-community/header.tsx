import { t } from '@/lib/i18n/t';
import type { ShellData } from '../types';
import { ButtonLink } from '../shared/ui/button-link';
import { Container } from '../shared/ui/container';
import { DesktopNav, MobileMenu } from '../shared/ui/nav';
import { BrandBadge } from './brand-badge';

/**
 * A floating glass capsule: the school's badge and name, navigation and a prominent rounded Apply
 * button. Content scrolls under and around it. The capsule reaches past the page's content edge by
 * its own padding, so the badge and the buttons inside line up with the content below. A soft
 * scroll edge (the page colour fading out behind the capsule) keeps text from showing sharply
 * above it, as Apple's floating bars do.
 */
export function CommunityHeader({ shell }: { shell: ShellData }) {
  const apply = shell.admissionsEnabled ? { label: t('site.apply'), href: '/admissions' } : null;
  return (
    <header className="sticky top-0 z-30 bg-[linear-gradient(to_bottom,var(--tpl-bg)_30%,transparent)] pt-3">
      <Container>
        <div className="tpl-glass -mx-2 flex min-h-15 items-center justify-between gap-6 rounded-full p-2 sm:-mx-3 sm:px-3">
          <BrandBadge shell={shell} />
          <div className="flex items-center gap-6">
            <DesktopNav items={shell.navigation} itemClassName="font-semibold" />
            {apply ? (
              <ButtonLink
                link={apply}
                className="hidden min-h-11 rounded-full px-6 lg:inline-flex"
              />
            ) : null}
            <MobileMenu
              shell={shell}
              apply={apply}
              buttonClassName="rounded-full bg-tpl-surface-alt px-4"
            />
          </div>
        </div>
      </Container>
    </header>
  );
}
