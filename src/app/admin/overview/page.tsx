import { LayoutDashboard } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { t } from '@/lib/i18n/t';

export const metadata = { title: 'Overview' };

export default function OverviewPage() {
  return (
    <>
      <PageHeader title={t('admin.overview.heading')} />
      <EmptyState
        icon={LayoutDashboard}
        title={t('admin.overview.emptyTitle')}
        description={t('admin.overview.emptyBody')}
      />
    </>
  );
}
