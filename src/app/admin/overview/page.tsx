import { LayoutDashboard } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { getAccess } from '@/lib/auth/access';
import { t } from '@/lib/i18n/t';

export const metadata = { title: 'Overview' };

export default async function OverviewPage() {
  const access = await getAccess();
  const firstName = access?.fullName.split(' ')[0];
  return (
    <>
      <PageHeader
        title={t('admin.overview.heading')}
        {...(firstName ? { description: `Welcome, ${firstName}.` } : {})}
      />
      <EmptyState
        icon={LayoutDashboard}
        title={t('admin.overview.emptyTitle')}
        description={t('admin.overview.emptyBody')}
      />
    </>
  );
}
