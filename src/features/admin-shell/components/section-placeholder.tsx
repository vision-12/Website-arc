import { forbidden } from 'next/navigation';
import { Construction } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { can, getAccess } from '@/lib/auth/access';
import { t } from '@/lib/i18n/t';
import { findSection, type AdminSectionKey } from '../sections';

/** Guards a section by its view permission; the server decides even if the link was hidden. */
export async function requireSection(section: AdminSectionKey) {
  const def = findSection(section);
  if (!def) throw new Error(`Unknown admin section: ${section}`);
  const access = await getAccess();
  if (def.permission && !can(access, def.permission)) forbidden();
  return def;
}

/** Shown for sections whose module arrives in a later phase; that phase replaces the route's page.tsx. */
export async function SectionPlaceholder({ section }: { section: AdminSectionKey }) {
  const def = await requireSection(section);
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
