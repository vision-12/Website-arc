import { getSiteSettings } from '@/features/cms/settings/queries';
import { getTemplate } from '@/features/templates/registry';
import { HomeSections, planHome } from '@/features/templates/shared/home-renderer';
import { Container } from '@/features/templates/shared/ui/container';
import { t } from '@/lib/i18n/t';

/** The homepage: the school's sections in its order, rendered by the active template. */
export default async function HomePage() {
  const { settings } = await getSiteSettings();
  const planned = await planHome(settings.homepage, settings);
  if (planned.length === 0) {
    return (
      <Container size="narrow" className="py-24">
        <h1 className="tpl-h2">{t('public.placeholderTitle')}</h1>
        <p className="mt-4 text-tpl-ink-muted">{t('public.placeholderBody')}</p>
      </Container>
    );
  }
  return (
    <HomeSections
      template={getTemplate(settings.theme.template)}
      planned={planned}
      settings={settings}
    />
  );
}
