import { NextResponse, type NextRequest } from 'next/server';
import { buildCsp, createNonce } from '@/lib/security/csp';

export const NONCE_HEADER = 'x-nonce';

/** Until Phase 2 adds authentication, the admin area must not be reachable in production. */
export function isAdminBlocked(pathname: string, vercelEnv: string | undefined): boolean {
  return vercelEnv === 'production' && (pathname === '/admin' || pathname.startsWith('/admin/'));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isAdminBlocked(pathname, process.env.VERCEL_ENV)) {
    return new NextResponse(null, { status: 404 });
  }

  const nonce = createNonce();
  const csp = buildCsp({
    nonce,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
    isDev: process.env.NODE_ENV === 'development',
  });

  // Next.js reads the nonce from the request's CSP header and applies it to its own scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(NONCE_HEADER, nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return response;
}

export const config = {
  matcher: [
    {
      source:
        '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
