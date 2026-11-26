import { PageHeader } from '@/components/shared/page-header';
import {
  placeholderMetadata,
  requireSection,
} from '@/features/admin-shell/components/section-placeholder';
import { getSiteSettings } from '@/features/cms/settings/queries';
import { NewPageDialog } from '@/features/pages/components/new-page-dialog';
import { PageTree } from '@/features/pages/components/page-tree';
import { listPages } from '@/features/pages/queries';
import { can, getAccess } from '@/lib/auth/access';
import { t } from '@/lib/i18n/t';

export const metadata = placeholderMetadata('pages');

/** Website pages (spec §5.4 `/admin/pages`): the page tree, statuses, ordering and nesting. */
export default async function PagesPage() {
  await requireSection('pages');
  const [access, pages, { settings }] = await Promise.all([
    getAccess(),
    listPages(),
    getSiteSettings(),
  ]);
  return (
    <>
      <PageHeader
        title={t('admin.sections.pages')}
        description="The pages of the website, in menu order. Open a page to edit it."
        {...(can(access, 'pages.create') ? { actions: <NewPageDialog pages={pages} /> } : {})}
      />
      <PageTree
        pages={pages}
        canEdit={can(access, 'pages.edit')}
        timezone={settings.locale.timezone}
      />
    </>
  );
}
