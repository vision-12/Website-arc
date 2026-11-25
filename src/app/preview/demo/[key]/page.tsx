import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Theme } from '@/features/cms/settings/schema';
import { getSiteSettings } from '@/features/cms/settings/queries';
import { getTemplate } from '@/features/templates/registry';
import { demoSectionData } from '@/features/templates/shared/demo/fixtures';
import { fallbackSections } from '@/features/templates/shared/fallbacks';
import type { HomeSectionType } from '@/features/templates/shared/section-settings';
import { resolveShell } from '@/features/templates/shared/shell';
import { TemplatePage } from '@/features/templates/shared/template-page';
import { themeStyle } from '@/features/templates/shared/theme-style';
import type { SectionComponent } from '@/features/templates/types';
import { currentYear } from '@/lib/dates/current-year';

const KEYS = Theme.shape.template.options;

export function generateStaticParams() {
  return KEYS.map((key) => ({ key }));
}

export const metadata: Metadata = { title: 'Template demo' };

/**
 * Demo gallery (P3-C): one template with demo content in every section, in the template's own
 * default fonts. For the design checkpoint, preview.png and accessibility tests. Never on a
 * school's production site.
 */
export default async function TemplateDemoPage({ params }: { params: Promise<{ key: string }> }) {
  if (process.env.VERCEL_ENV === 'production') notFound();
  const { key } = await params;
  const parsed = Theme.shape.template.safeParse(key);
  if (!parsed.success) notFound();

  const template = getTemplate(parsed.data);
  const { settings } = await getSiteSettings();
  const shell = await resolveShell(settings, await currentYear());
  const data = demoSectionData();
  const style = themeStyle({
    ...settings.theme,
    template: template.key,
    fontHeading: template.defaults.fontHeading,
    fontBody: template.defaults.fontBody,
    radius: template.defaults.radius,
  });

  return (
    <TemplatePage template={template} shell={shell} style={style}>
      {template.homeTitle === 'hero' ? null : <h1 className="sr-only">{settings.identity.name}</h1>}
      {template.defaults.homepageOrder.map((type: HomeSectionType, index) => {
        const Component = (template.sections[type] ??
          fallbackSections[type]) as SectionComponent<HomeSectionType>;
        return (
          <Component
            key={type}
            id={`demo-${type}`}
            data={data[type]}
            locale={settings.locale}
            {...(template.homeTitle === 'hero' && index === 0
              ? { schoolNameAsH1: settings.identity.name }
              : {})}
          />
        );
      })}
    </TemplatePage>
  );
}
