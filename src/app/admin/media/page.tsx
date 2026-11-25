import { PageHeader } from '@/components/shared/page-header';
import {
  placeholderMetadata,
  requireSection,
} from '@/features/admin-shell/components/section-placeholder';
import { MediaLibrary } from '@/features/media/components/media-library';
import { listMedia } from '@/features/media/queries';
import { can, getAccess } from '@/lib/auth/access';
import { t } from '@/lib/i18n/t';

export const metadata = placeholderMetadata('media');

/** The media library (MP §5.9, spec §5.4). The server checks every action again. */
export default async function MediaPage() {
  await requireSection('media');
  const [access, initial] = await Promise.all([getAccess(), listMedia({ page: 1 })]);
  return (
    <>
      <PageHeader
        title={t('admin.sections.media')}
        description="Photos and PDFs for the website. Every photo needs a short description before it can go on a page."
      />
      <MediaLibrary
        initial={initial}
        can={{
          create: can(access, 'media.create'),
          edit: can(access, 'media.edit'),
          delete: can(access, 'media.delete'),
        }}
      />
    </>
  );
}
