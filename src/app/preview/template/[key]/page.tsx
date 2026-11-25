import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { applyPreview, readPreviewToken } from '@/features/appearance/preview';
import { TemplateKey } from '@/features/appearance/schema';
import { getSiteSettings } from '@/features/cms/settings/queries';
import { getTemplate } from '@/features/templates/registry';
import { HomeSections, planHome } from '@/features/templates/shared/home-renderer';
import { resolveShell } from '@/features/templates/shared/shell';
import { TemplatePage } from '@/features/templates/shared/template-page';
import { themeStyle } from '@/features/templates/shared/theme-style';
import { Container } from '@/features/templates/shared/ui/container';
import { can, getAccess } from '@/lib/auth/access';
import { currentYear } from '@/lib/dates/current-year';
import { fill } from '@/lib/i18n/format';
import { t } from '@/lib/i18n/t';

export function generateStaticParams() {
  return TemplateKey.options.map((key) => ({ key }));
}

export const metadata: Metadata = { title: t('preview.title') };

type Params = Promise<{ key: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * The real homepage in a candidate template (spec §6.4): the saved settings with the token's
 * template and unsaved changes merged in memory. It never writes. Only the user the link was
 * issued to can open it, and only while they hold appearance.view. Framing is allowed from this
 * site only (proxy.ts, next.config.ts) so the Appearance page can embed it.
 */
export default function TemplatePreviewPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={null}>
      <Preview params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Preview({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { key } = await params;
  const template = TemplateKey.safeParse(key);
  if (!template.success) notFound();
  const raw = (await searchParams).t;
  const token = typeof raw === 'string' ? raw : undefined;

  const access = await getAccess();
  if (!access) {
    redirect(`/login?next=${encodeURIComponent(`/preview/template/${key}?t=${token ?? ''}`)}`);
  }
  if (!can(access, 'appearance.view')) return <PreviewMessage kind="noAccess" />;

  const result = readPreviewToken(token, { userId: access.userId, template: template.data });
  if (!result.ok)
    return <PreviewMessage kind={result.error === 'expired' ? 'expired' : 'invalid'} />;

  const { settings: saved } = await getSiteSettings();
  const settings = applyPreview(saved, result.payload);
  const definition = getTemplate(settings.theme.template);
  const [shell, planned] = await Promise.all([
    resolveShell(settings, await currentYear()),
    planHome(settings.homepage, settings),
  ]);

  return (
    <>
      <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-neutral-900 px-4 py-2 text-center text-sm text-white">
        <span>{fill(t('preview.bar'), { template: definition.label })}</span>
        <Link href="/admin/appearance" className="font-semibold underline underline-offset-4">
          {t('preview.backToAppearance')}
        </Link>
      </p>
      <TemplatePage template={definition} shell={shell} style={themeStyle(settings.theme)}>
        {planned.length > 0 ? (
          <HomeSections template={definition} planned={planned} settings={settings} />
        ) : (
          <Container size="narrow" className="py-24">
            <h1 className="tpl-h2">{t('public.placeholderTitle')}</h1>
            <p className="mt-4 text-tpl-ink-muted">{t('public.placeholderBody')}</p>
          </Container>
        )}
      </TemplatePage>
    </>
  );
}

const MESSAGES = {
  invalid: ['preview.invalidTitle', 'preview.invalidBody'],
  expired: ['preview.expiredTitle', 'preview.expiredBody'],
  noAccess: ['preview.noAccessTitle', 'preview.noAccessBody'],
} as const;

function PreviewMessage({ kind }: { kind: keyof typeof MESSAGES }) {
  const [title, body] = MESSAGES[kind];
  return (
    <main id="main-content" className="grid min-h-dvh place-items-center bg-background p-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t(title)}</h1>
        <p className="mt-3 text-muted-foreground">{t(body)}</p>
        <Link
          href="/admin/appearance"
          className="mt-6 inline-flex min-h-11 items-center rounded-md border px-4 font-medium hover:bg-accent"
        >
          {t('preview.backToAppearance')}
        </Link>
      </div>
    </main>
  );
}
