import '@/features/templates/shared/base.css';
import '@/features/templates/institutional-classic/tokens.css';
import { SkipLink } from '@/components/shared/skip-link';
import { getSiteSettings } from '@/features/cms/settings/queries';
import { getTemplate } from '@/features/templates/registry';
import { MenuEnhancer } from '@/features/templates/shared/islands/menu-enhancer';
import { resolveShell } from '@/features/templates/shared/shell';
import { currentYear } from '@/lib/dates/current-year';

/** The public site in the school's chosen template (MP §3.3): its header, the page, its footer. */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const { settings } = await getSiteSettings();
  const template = getTemplate(settings.theme.template);
  const shell = await resolveShell(settings, await currentYear());
  const { Header, Footer } = template;
  return (
    <div data-template={template.key} className="site-scope flex min-h-dvh flex-col">
      <SkipLink />
      <Header shell={shell} />
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <Footer shell={shell} />
      <MenuEnhancer />
    </div>
  );
}
