import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireSection } from '@/features/admin-shell/components/section-placeholder';
import { getSiteSettings } from '@/features/cms/settings/queries';
import { canEditContent, editorActions } from '@/features/content/lifecycle';
import { getMediaByIds } from '@/features/media/queries';
import { PageEditor } from '@/features/pages/components/page-editor';
import { pagesContent } from '@/features/pages/module';
import {
  approvalOn,
  pageEditorContext,
  withoutTrashForBuiltIn,
} from '@/features/pages/permissions';
import { listPages, parentOptions } from '@/features/pages/queries';
import { can, requireUser } from '@/lib/auth/access';
import { requestTime } from '@/lib/dates/zoned';
import { publicEnv } from '@/lib/env/public';
import { richTextMediaIds } from '@/lib/rich-text/media';

export const metadata = { title: 'Edit page' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The page editor (spec §5.4 `/admin/pages/[id]`). Buttons follow permissions; the server decides. */
export default async function EditPage({ params }: PageProps<'/admin/pages/[id]'>) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  await requireSection('pages');
  const access = await requireUser();
  const [state, approval, pages, { settings }] = await Promise.all([
    pagesContent.loadEditor(id, access),
    approvalOn(),
    listPages(),
    getSiteSettings(),
  ]);
  if (!state) notFound();

  const ctx = pageEditorContext(access, state.row, approval);
  const docs = [state.values.body, ...(state.copy?.values.body ? [state.copy.values.body] : [])];
  const ids = docs.flatMap((d) => {
    const m = richTextMediaIds(d);
    return [...m.images, ...m.documents];
  });
  for (const cover of [state.values.coverMediaId, state.copy?.values.coverMediaId])
    if (cover) ids.push(cover);
  const media = await getMediaByIds(ids);

  return (
    <>
      <Link
        href="/admin/pages"
        className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        All pages
      </Link>
      <h1 className="sr-only">Edit page: {state.row.title}</h1>
      <PageEditor
        key={`${state.row.id}:${state.row.version}`}
        page={{
          id: state.row.id,
          version: state.row.version,
          status: state.row.status,
          publishAt: state.row.publish_at,
          publishedAt: state.row.published_at,
          updatedAt: state.row.updated_at,
          path: state.row.path,
          systemKey: state.row.system_key,
          deleted: state.row.deleted_at !== null,
        }}
        values={state.values}
        copy={state.copy}
        editors={state.editors}
        reviewNote={state.reviewNote}
        lastEditedBy={state.lastEditedBy}
        actions={withoutTrashForBuiltIn(editorActions(ctx), state.row.system_key)}
        canEdit={canEditContent(ctx)}
        parents={parentOptions(pages, id)}
        media={media}
        timezone={settings.locale.timezone}
        siteHost={new URL(publicEnv.NEXT_PUBLIC_SITE_URL).host}
        canUpload={can(access, 'media.create')}
        canDescribe={can(access, 'media.edit')}
        renderedAt={requestTime()}
      />
    </>
  );
}
