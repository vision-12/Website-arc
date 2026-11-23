import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { SkipLink } from '@/components/shared/skip-link';
import { OfflineBanner } from '@/components/shared/offline-banner';
import { Toaster } from '@/components/ui/toast';
import { MobileNav } from '@/features/admin-shell/components/mobile-nav';
import { SidebarNav } from '@/features/admin-shell/components/sidebar-nav';
import { UserMenu } from '@/features/admin-shell/components/user-menu';
import { visibleSections } from '@/features/admin-shell/sections';
import { getSiteSettings } from '@/features/cms/settings/queries';
import { t } from '@/lib/i18n/t';
import './admin-tokens.css';

export const metadata = { robots: { index: false, follow: false } };

/** Admin shell in Altrastate branding (MP §11). Phase 2 supplies real permissions instead of 'all'. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { settings } = await getSiteSettings();
  const keys = visibleSections('all').map((s) => s.key);

  return (
    <div className="admin-scope flex min-h-dvh bg-background text-foreground">
      <SkipLink />
      <aside className="admin-sidebar sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-[var(--admin-sidebar)] lg:flex">
        <div className="px-6 pt-6 pb-4">
          <p className="text-xs font-medium tracking-wide text-[var(--admin-sidebar-foreground)] uppercase">
            Altrastate School
          </p>
          <p className="mt-1 truncate font-semibold text-white">{settings.identity.name}</p>
        </div>
        <nav aria-label={t('admin.navLabel')} className="flex-1 overflow-y-auto px-3 pb-6">
          <SidebarNav keys={keys} />
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <OfflineBanner />
        <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b bg-card px-4 lg:px-8">
          <MobileNav keys={keys} />
          <p className="flex-1 truncate font-semibold lg:hidden">{settings.identity.name}</p>
          <p className="hidden flex-1 text-sm text-muted-foreground lg:block">{t('admin.title')}</p>
          <Link
            href="/"
            target="_blank"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 text-sm font-medium hover:bg-accent"
          >
            {t('common.viewWebsite')}
            <ExternalLink className="size-4" aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </Link>
          <UserMenu />
        </header>
        <main id="main-content" tabIndex={-1} className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
      <Toaster />
    </div>
  );
}
