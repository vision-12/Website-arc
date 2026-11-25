import { Suspense } from 'react';
import type { Metadata, Route } from 'next';
import { draftMode } from 'next/headers';
import { notFound, permanentRedirect } from 'next/navigation';
import { getSiteSettings } from '@/features/cms/settings/queries';
import { CmsPage, PreviewBar } from '@/features/pages/components/cms-page';
import {
  findRedirect,
  getPreviewPage,
  getPublishedPage,
  getPublishedPagePaths,
} from '@/features/pages/queries';
import { getTemplate } from '@/features/templates/registry';
import type { TemplateDefinition } from '@/features/templates/types';
import { can, getAccess } from '@/lib/auth/access';

/**
 * CMS pages by address (spec §5.1 `/[...slug]`, including the About and Legal trees). Built-in
 * sections (news, events, …) are static route folders and take precedence. Unknown addresses look
 * for a redirect (old address after a rename or move) before showing "not found" (plan P4-H).
 */

const toPath = (slug: string[]) => `/${slug.join('/')}`;

export async function generateStaticParams() {
  const paths = await getPublishedPagePaths().catch(() => []);
  const params = paths.map((p) => ({ slug: p.split('/').filter(Boolean) }));
  // Cache Components needs at least one entry; unknown addresses render on first visit.
  return params.length > 0 ? params : [{ slug: ['no-pages-yet'] }];
}

export async function generateMetadata({ params }: PageProps<'/[...slug]'>): Promise<Metadata> {
  const path = toPath((await params).slug);
  if ((await draftMode()).isEnabled) return { robots: { index: false, follow: false } };
  const page = await getPublishedPage(path);
  if (!page) return { robots: { index: false } };
  const description = page.seo.description ?? page.excerpt ?? undefined;
  return {
    title: page.seo.title ?? page.title,
    ...(description ? { description } : {}),
    ...(page.seo.noindex ? { robots: { index: false, follow: true } } : {}),
    alternates: { canonical: path },
  };
}

async function Preview({ path, template }: { path: string; template: TemplateDefinition }) {
  const access = await getAccess();
  // Draft mode without a signed-in editor shows only what visitors may see.
  if (!can(access, 'pages.view') || !access) {
    const page = await getPublishedPage(path);
    if (!page) notFound();
    return <CmsPage page={page} template={template} />;
  }
  const page = await getPreviewPage(path, access.userId);
  if (!page) notFound();
  return (
    <>
      <PreviewBar editorHref={`/admin/pages/${page.id}`} />
      <CmsPage page={page} template={template} />
    </>
  );
}

export default async function CmsRoute({ params }: PageProps<'/[...slug]'>) {
  const path = toPath((await params).slug);
  const lower = path.toLowerCase();
  if (lower !== path) permanentRedirect(lower as Route);

  const [{ isEnabled }, { settings }] = await Promise.all([draftMode(), getSiteSettings()]);
  const template = getTemplate(settings.theme.template);
  if (isEnabled)
    return (
      <Suspense fallback={<div className="min-h-[60dvh]" aria-busy="true" />}>
        <Preview path={path} template={template} />
      </Suspense>
    );

  const page = await getPublishedPage(path);
  if (!page) {
    const to = await findRedirect(path);
    if (to) permanentRedirect(to as Route);
    notFound();
  }
  return <CmsPage page={page} template={template} />;
}
