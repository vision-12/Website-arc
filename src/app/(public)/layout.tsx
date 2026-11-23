import { SkipLink } from '@/components/shared/skip-link';
import { getSiteSettings } from '@/features/cms/settings/queries';
import { currentYear } from '@/lib/dates/current-year';

/** Minimal public shell. Phase 3 replaces the header/footer with the active template's components. */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const { settings } = await getSiteSettings();
  const year = await currentYear();
  return (
    <div className="site-scope flex min-h-dvh flex-col">
      <SkipLink />
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center px-4 py-4">
          <p className="text-lg font-semibold">{settings.identity.name}</p>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        {children}
      </main>
      <footer className="border-t bg-card">
        <p className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted-foreground">
          © {year} {settings.footer.copyrightName ?? settings.identity.name}
        </p>
      </footer>
    </div>
  );
}
