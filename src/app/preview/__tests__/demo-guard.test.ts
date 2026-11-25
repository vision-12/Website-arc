import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env/public', () => ({
  publicEnv: {
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  },
}));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));

const { default: DemoHome } = await import('../demo/[key]/page');
const { default: DemoInner } = await import('../demo/[key]/page/[layout]/page');

afterEach(() => vi.unstubAllEnvs());

describe('demo gallery (plan P3-C)', () => {
  it('returns 404 on a school’s production deployment', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    await expect(DemoHome({ params: Promise.resolve({ key: 'modern-academic' }) })).rejects.toThrow(
      'NOT_FOUND',
    );
    await expect(
      DemoInner({ params: Promise.resolve({ key: 'modern-academic', layout: 'wide' }) }),
    ).rejects.toThrow('NOT_FOUND');
  });

  it('returns 404 for unknown templates and layouts', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    await expect(DemoHome({ params: Promise.resolve({ key: 'neon' }) })).rejects.toThrow(
      'NOT_FOUND',
    );
    await expect(
      DemoInner({ params: Promise.resolve({ key: 'modern-academic', layout: 'poster' }) }),
    ).rejects.toThrow('NOT_FOUND');
  });
});
