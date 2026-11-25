import { NextResponse, type NextRequest } from 'next/server';
import { buildCsp, createNonce } from '@/lib/security/csp';
import { refreshSession } from '@/lib/supabase/proxy';

export const NONCE_HEADER = 'x-nonce';

const isAdminPath = (pathname: string) => pathname === '/admin' || pathname.startsWith('/admin/');
/** Template previews (spec §6.4): signed-in only, private, framed by this site only. */
const isTemplatePreview = (pathname: string) => pathname.startsWith('/preview/template/');

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const nonce = createNonce();
  const csp = buildCsp({
    nonce,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321',
    isDev: process.env.NODE_ENV === 'development',
    frameAncestors: isTemplatePreview(pathname) ? 'self' : 'none',
  });

  // Next.js reads the nonce from the request's CSP header and applies it to its own scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(NONCE_HEADER, nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  // Refresh the Supabase session (MP §2.4). Cookies land on whichever response we return.
  const { response, claims } = await refreshSession(request, () =>
    NextResponse.next({ request: { headers: requestHeaders } }),
  );

  let result: NextResponse = response;
  if ((isAdminPath(pathname) || isTemplatePreview(pathname)) && !claims) {
    // Not signed in: send to the login page, remembering where they were going.
    const login = new URL('/login', request.url);
    login.searchParams.set('next', pathname + search);
    result = NextResponse.redirect(login);
    for (const cookie of response.cookies.getAll()) result.cookies.set(cookie);
  }

  result.headers.set('Content-Security-Policy', csp);
  if (
    isAdminPath(pathname) ||
    isTemplatePreview(pathname) ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth/')
  ) {
    result.headers.set('Cache-Control', 'private, no-store');
    result.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return result;
}

export const config = {
  matcher: [
    {
      source:
        '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|theme.css).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
