import { Construction } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { findSection, type AdminSectionKey } from '../sections';
import { t } from '@/lib/i18n/t';

/** Shown for sections whose module arrives in a later phase; that phase replaces the route's page.tsx. */
export function SectionPlaceholder({ section }: { section: AdminSectionKey }) {
  const def = findSection(section);
  if (!def) throw new Error(`Unknown admin section: ${section}`);
  return (
    <>
      <PageHeader title={t(def.labelKey)} />
      <EmptyState
        icon={Construction}
        title={t('admin.sectionEmpty.title')}
        description={t('admin.sectionEmpty.body')}
      />
    </>
  );
}

export function placeholderMetadata(section: AdminSectionKey) {
  const def = findSection(section);
  return { title: def ? t(def.labelKey) : '' };
}
