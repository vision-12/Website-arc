import { getSiteSettings } from '@/features/cms/settings/queries';

/** Centred card for the sign-in screens, in Altrastate's admin branding (PRD §22.2). */
export async function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const { settings } = await getSiteSettings();
  return (
    <div className="admin-scope flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <main id="main-content" className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Altrastate School
          </p>
          <p className="mt-1 text-lg font-semibold">{settings.identity.name}</p>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
