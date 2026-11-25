import type { NextConfig } from 'next';
import { assertEnv } from './src/lib/env/schema';

assertEnv(process.env);

const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000');
const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321');

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
];

const config: NextConfig = {
  cacheComponents: true,
  // Prefetch only the static parts of routes — saves parents' mobile data.
  partialPrefetching: true,
  typedRoutes: true,
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    serverActions: { allowedOrigins: [siteUrl.host] },
    // forbidden() / unauthorized() → 403/401 pages for permission failures.
    authInterrupts: true,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    // Next refuses to optimise images from private IPs (SSRF protection). Only the local Supabase
    // stack (dev and CI) lives on loopback; a school's real project is a public supabase.co host,
    // so production keeps the protection. remotePatterns below still pins the one allowed host.
    dangerouslyAllowLocalIP: ['127.0.0.1', 'localhost'].includes(supabaseUrl.hostname),
    remotePatterns: [
      {
        protocol: supabaseUrl.protocol.replace(':', '') as 'http' | 'https',
        hostname: supabaseUrl.hostname,
        ...(supabaseUrl.port ? { port: supabaseUrl.port } : {}),
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  headers() {
    return Promise.resolve([
      { source: '/:path*', headers: securityHeaders },
      // The template preview is embedded by the Appearance page (spec §6.4). For the same header
      // key, the later rule wins; the CSP's frame-ancestors 'self' is set in proxy.ts.
      {
        source: '/preview/template/:path*',
        headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }],
      },
    ]);
  },
};

export default config;
