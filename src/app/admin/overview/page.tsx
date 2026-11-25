import Link from 'next/link';
import { ArrowRight, CircleCheck } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { getSiteSettings } from '@/features/cms/settings/queries';
import { getDashboardCounts, getRecentContentActivity } from '@/features/dashboard/queries';
import { dashboardTiles } from '@/features/dashboard/tiles';
import { approvalOn } from '@/features/pages/permissions';
import { can, requireUser } from '@/lib/auth/access';
import { formatDateTimeShort } from '@/lib/dates/zoned';
import { t } from '@/lib/i18n/t';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Overview' };

/** The dashboard (MP §5.10): what needs doing, each tile linking to its list; recent changes. */
export default async function OverviewPage() {
  const access = await requireUser();
  const [counts, approval, activity, { settings }] = await Promise.all([
    getDashboardCounts(),
    approvalOn(),
    can(access, 'activity.view') ? getRecentContentActivity() : Promise.resolve(null),
    getSiteSettings(),
  ]);
  const tiles = dashboardTiles(counts, (p) => access.permissions.has(p), approval);
  const firstName = access.fullName.split(' ')[0];
  const nothingToDo = tiles.every((tile) => tile.count === 0);

  return (
    <>
      <PageHeader
        title={t('admin.overview.heading')}
        {...(firstName ? { description: `Welcome, ${firstName}.` } : {})}
      />
      {tiles.length === 0 || nothingToDo ? (
        <EmptyState
          icon={CircleCheck}
          title="All caught up"
          description="Nothing needs your attention right now. Applications, enquiries and events will appear here as those sections are switched on."
        />
      ) : null}
      {tiles.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Things to do">
          {tiles.map((tile) => (
            <li key={tile.key}>
              <Link
                href={tile.href}
                className={cn(
                  'flex h-full flex-col gap-2 rounded-xl border bg-card p-5 hover:border-primary',
                  tile.attention && 'border-l-4 border-l-warning',
                )}
              >
                <span className="text-3xl font-semibold tabular-nums" aria-hidden="true">
                  {tile.count}
                </span>
                <span className="font-medium">{tile.label}</span>
                <span className="text-sm text-muted-foreground">{tile.hint}</span>
                <span className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-medium">
                  Open the list
                  <ArrowRight className="size-4" aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {activity ? (
        <section aria-labelledby="recent-activity" className="mt-8 space-y-3">
          <h2 id="recent-activity" className="text-lg font-semibold">
            Recent changes to the website
          </h2>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No changes yet.</p>
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {activity.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-1 p-4 sm:flex-row sm:items-baseline sm:justify-between"
                >
                  <span className="text-sm">
                    <strong className="font-medium">{item.who}</strong>{' '}
                    {item.summary.charAt(0).toLowerCase()}
                    {item.summary.slice(1)}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDateTimeShort(item.at, settings.locale.timezone)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </>
  );
}
