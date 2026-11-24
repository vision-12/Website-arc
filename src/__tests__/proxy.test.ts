import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { proxy } from '../proxy';

const req = (path: string) => new NextRequest(new URL(path, 'https://www.example-school.test'));

// No Supabase URL in unit tests: refreshSession() returns no claims without network calls,
// which models a signed-out visitor.
beforeEach(() => vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', ''));
afterEach(() => vi.unstubAllEnvs());

describe('proxy', () => {
  it('sets a CSP with a fresh nonce on every response and forwards it to the app', async () => {
    const a = await proxy(req('/'));
    const b = await proxy(req('/'));
    const csp = a.headers.get('content-security-policy')!;
    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+'/);
    expect(csp).not.toBe(b.headers.get('content-security-policy'));
    expect(a.headers.get('x-middleware-request-x-nonce')).toBe(/'nonce-([^']+)'/.exec(csp)![1]);
  });

  it('sends signed-out visitors of the admin area to the login page, keeping their destination', async () => {
    const res = await proxy(req('/admin/news?page=2'));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get('location')!);
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('next')).toBe('/admin/news?page=2');
    expect(res.headers.get('content-security-policy')).toMatch(/nonce-/);
  });

  it('marks admin and auth responses private and noindex', async () => {
    for (const path of ['/admin/overview', '/login', '/auth/confirm']) {
      const res = await proxy(req(path));
      expect(res.headers.get('cache-control'), path).toBe('private, no-store');
      expect(res.headers.get('x-robots-tag'), path).toMatch(/noindex/);
    }
    expect((await proxy(req('/'))).headers.get('cache-control')).toBeNull();
  });

  it('leaves public pages alone', async () => {
    expect((await proxy(req('/'))).status).toBe(200);
    expect((await proxy(req('/administration-policy'))).status).toBe(200);
  });
});
