import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { SkipLink } from '@/components/shared/skip-link';
import { StyleNonce } from '@/components/shared/style-nonce';
import { OfflineBanner } from '@/components/shared/offline-banner';
import { Skeleton } from '@/components/ui/skeleton';
import { Toaster } from '@/components/ui/toast';
import { MobileNav } from '@/features/admin-shell/components/mobile-nav';
import { SidebarNav } from '@/features/admin-shell/components/sidebar-nav';
import { UserMenu } from '@/features/admin-shell/components/user-menu';
import { visibleSections } from '@/features/admin-shell/sections';
import { getSiteSettings } from '@/features/cms/settings/queries';
import { getAccess } from '@/lib/auth/access';
import { t } from '@/lib/i18n/t';
import './admin-tokens.css';

export const metadata = { robots: { index: false, follow: false } };

/**
 * Everything that depends on the signed-in user. Rendered per request inside <Suspense>; the
 * proxy has already sent signed-out visitors to /login.
 */
async function AdminFrame({
  children,
  schoolName,
}: {
  children: React.ReactNode;
  schoolName: string;
}) {
  const access = await getAccess();
  if (!access) redirect('/login?next=/admin/overview');
  if (access.status !== 'active') redirect('/auth/signout?reason=inactive');
  if (access.needsMfaStep)
    redirect(access.mfaEnrolled ? '/mfa?next=/admin/overview' : '/mfa/setup?next=/admin/overview');

  const keys = visibleSections(access.permissions).map((s) => s.key);
  return (
    <>
      <aside className="admin-sidebar sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-[var(--admin-sidebar)] lg:flex">
        <div className="px-6 pt-6 pb-4">
          <p className="text-xs font-medium tracking-wide text-[var(--admin-sidebar-foreground)] uppercase">
            Altrastate School
          </p>
          <p className="mt-1 truncate font-semibold text-white">{schoolName}</p>
        </div>
        <nav aria-label={t('admin.navLabel')} className="flex-1 overflow-y-auto px-3 pb-6">
          <SidebarNav keys={keys} />
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <OfflineBanner />
        <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b bg-card px-4 lg:px-8">
          <MobileNav keys={keys} />
          <p className="flex-1 truncate font-semibold lg:hidden">{schoolName}</p>
          <p className="hidden flex-1 text-sm text-muted-foreground lg:block">{t('admin.title')}</p>
          <Link
            href="/"
            target="_blank"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 text-sm font-medium hover:bg-accent"
          >
            <span className="hidden sm:inline">{t('common.viewWebsite')}</span>
            <ExternalLink className="size-4" aria-hidden="true" />
            <span className="sr-only">{t('common.viewWebsite')} (opens in a new tab)</span>
          </Link>
          <UserMenu name={access.fullName} email={access.email} roles={access.roles} />
        </header>
        <main id="main-content" tabIndex={-1} className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-w-0 flex-1 flex-col" aria-busy="true">
      <div className="h-16 border-b bg-card" />
      <div className="space-y-4 px-4 py-6 lg:px-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}

/** Admin shell in Altrastate branding (MP §11). The sidebar shows only permitted sections (PRD §6.2). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { settings } = await getSiteSettings();
  return (
    <div className="admin-scope flex min-h-dvh bg-background text-foreground">
      {/* Radix overlays inject scroll-lock styles that need the CSP nonce (admin only). */}
      <StyleNonce />
      <SkipLink />
      <Suspense fallback={<ShellSkeleton />}>
        <AdminFrame schoolName={settings.identity.name}>{children}</AdminFrame>
      </Suspense>
      <Toaster />
    </div>
  );
}
