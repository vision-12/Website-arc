import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Theme } from '@/features/cms/settings/schema';
import { getSiteSettings } from '@/features/cms/settings/queries';
import { getTemplate } from '@/features/templates/registry';
import { demoInnerPage } from '@/features/templates/shared/demo/fixtures';
import { resolveShell } from '@/features/templates/shared/shell';
import { TemplatePage } from '@/features/templates/shared/template-page';
import { themeStyle } from '@/features/templates/shared/theme-style';
import { RichText } from '@/features/templates/shared/ui/rich-text';
import { SmartLink } from '@/features/templates/shared/ui/smart-link';
import type { PageFrameProps } from '@/features/templates/types';
import { currentYear } from '@/lib/dates/current-year';
import { t } from '@/lib/i18n/t';

const KEYS = Theme.shape.template.options;
const LAYOUTS = {
  default: 'default',
  wide: 'wide',
  'with-sidebar': 'with_sidebar',
} as const satisfies Record<string, PageFrameProps['layout']>;

export function generateStaticParams() {
  return KEYS.flatMap((key) => Object.keys(LAYOUTS).map((layout) => ({ key, layout })));
}

export const metadata: Metadata = { title: 'Template demo: inner page' };

/**
 * Demo gallery, inner pages (plan §4.6): one template's page frame in one of its three layouts,
 * with the kind of content the Phase 4 editor produces. 404 on a school's production site.
 */
export default async function TemplateDemoInnerPage({
  params,
}: {
  params: Promise<{ key: string; layout: string }>;
}) {
  if (process.env.VERCEL_ENV === 'production') notFound();
  const { key, layout } = await params;
  const parsed = Theme.shape.template.safeParse(key);
  if (!parsed.success || !(layout in LAYOUTS)) notFound();

  const template = getTemplate(parsed.data);
  const { settings } = await getSiteSettings();
  const shell = await resolveShell(settings, await currentYear());
  const page = demoInnerPage();
  const style = themeStyle({
    ...settings.theme,
    template: template.key,
    fontHeading: template.defaults.fontHeading,
    fontBody: template.defaults.fontBody,
    radius: template.defaults.radius,
  });
  const frameLayout = LAYOUTS[layout as keyof typeof LAYOUTS];
  const { PageFrame } = template;

  return (
    <TemplatePage template={template} shell={shell} style={style}>
      <PageFrame
        layout={frameLayout}
        title={page.title}
        breadcrumbs={page.breadcrumbs}
        sidebar={
          <nav aria-label={t('site.inThisSection')}>
            <h2 className="tpl-label text-tpl-ink-muted">{t('site.inThisSection')}</h2>
            <ul className="mt-3 space-y-1">
              {page.sectionLinks.map((link) => (
                <li key={link.href}>
                  <SmartLink
                    href={link.href}
                    className="flex min-h-11 items-center font-medium aria-[current=page]:text-tpl-brand-text"
                    {...(link.current ? { 'aria-current': 'page' as const } : {})}
                  >
                    {link.label}
                  </SmartLink>
                </li>
              ))}
            </ul>
          </nav>
        }
      >
        <RichText {...(frameLayout === 'wide' ? { className: 'max-w-3xl' } : {})}>
          {page.body}
        </RichText>
      </PageFrame>
    </TemplatePage>
  );
}
