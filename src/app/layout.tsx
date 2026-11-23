import { Suspense } from 'react';
import type { Metadata, Viewport } from 'next';
import { connection } from 'next/server';
import { StyleNonce } from '@/components/shared/style-nonce';
import { getSiteSettings } from '@/features/cms/settings/queries';
import { fontVariableClassNames } from '@/lib/fonts/fonts';
import { publicEnv } from '@/lib/env/public';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getSiteSettings();
  return {
    metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),
    title: {
      default: settings.identity.name,
      template: settings.seo.defaultTitleTemplate.includes('%s')
        ? settings.seo.defaultTitleTemplate
        : `%s | ${settings.identity.name}`,
    },
    ...(settings.seo.defaultDescription ? { description: settings.seo.defaultDescription } : {}),
    robots: settings.seo.indexable ? undefined : { index: false, follow: false },
  };
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

/**
 * Makes every route request-bound without delaying the prerendered shell.
 * Why: Next.js stamps the per-request CSP nonce on its inline scripts only when a route has a
 * dynamic part. A fully static route would be served with un-nonced scripts that the CSP blocks.
 * See docs/adr/000-stack.md, "CSP and static shells".
 */
async function RequestBoundary() {
  await connection();
  return null;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { version } = await getSiteSettings();
  return (
    <html lang="en-GB" className={fontVariableClassNames}>
      <head>
        {/* School theme as a same-origin stylesheet: render-blocking (no unthemed flash), CSP-safe, cacheable. */}
        <link rel="stylesheet" href={`/theme.css?v=${version}`} precedence="theme" />
      </head>
      <body>
        <StyleNonce />
        {children}
        <Suspense fallback={null}>
          <RequestBoundary />
        </Suspense>
      </body>
    </html>
  );
}
