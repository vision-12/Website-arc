import { PageHeader } from '@/components/shared/page-header';
import {
  placeholderMetadata,
  requireSection,
} from '@/features/admin-shell/components/section-placeholder';
import { getSiteSettings } from '@/features/cms/settings/queries';
import { listTrashedMedia } from '@/features/media/queries';
import { TrashList, type TrashItem } from '@/features/trash/components/trash-list';
import { can, requireUser } from '@/lib/auth/access';
import { formatDateTimeShort } from '@/lib/dates/zoned';
import { t } from '@/lib/i18n/t';
import { createClient } from '@/lib/supabase/server';

export const metadata = placeholderMetadata('trash');

/** Items stay in Trash this long; the Phase 13 retention job empties it (plan P4-L). */
const TRASH_DAYS = 30;

/** Trash (spec §5.4 `/admin/trash`): pages and media the person may delete. */
export default async function TrashPage() {
  await requireSection('trash');
  const access = await requireUser();
  const supabase = await createClient();
  const [pages, media, { settings }] = await Promise.all([
    can(access, 'pages.delete')
      ? supabase
          .from('pages')
          .select('id, title, deleted_at, deleted_by')
          .not('deleted_at', 'is', null)
          .order('deleted_at', { ascending: false })
          .limit(200)
          .then(({ data }) => data ?? [])
      : Promise.resolve([]),
    can(access, 'media.delete') ? listTrashedMedia() : Promise.resolve([]),
    getSiteSettings(),
  ]);
  const ids = pages.map((p) => p.deleted_by).filter((id): id is string => id !== null);
  const { data: names } = ids.length
    ? await supabase.rpc('staff_names', { p_ids: [...new Set(ids)] })
    : { data: [] };
  const nameOf = new Map((names ?? []).map((n) => [n.id, n.full_name]));
  const tz = settings.locale.timezone;
  const until = (iso: string) =>
    formatDateTimeShort(
      new Date(new Date(iso).getTime() + TRASH_DAYS * 86_400_000).toISOString(),
      tz,
    );

  const items: TrashItem[] = [
    ...pages.map((p) => ({
      id: p.id,
      kind: 'page' as const,
      title: p.title,
      deletedOn: formatDateTimeShort(p.deleted_at, tz),
      deletedBy: p.deleted_by ? (nameOf.get(p.deleted_by) ?? null) : null,
      keptUntil: until(p.deleted_at),
      canRestore: true,
    })),
    ...media.map((m) => ({
      id: m.id,
      kind: m.kind === 'image' ? ('photo' as const) : ('document' as const),
      title: m.filename,
      deletedOn: formatDateTimeShort(m.deletedAt ?? '', tz),
      deletedBy: null,
      keptUntil: until(m.deletedAt ?? ''),
      canRestore: true,
    })),
  ];

  return (
    <>
      <PageHeader
        title={t('admin.sections.trash')}
        description={`Restore anything moved to Trash in the last ${TRASH_DAYS} days.`}
      />
      <TrashList items={items} canPurge={can(access, 'trash.purge')} />
    </>
  );
}
