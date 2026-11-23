import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAdminBlocked, proxy } from '../proxy';

const req = (path: string) => new NextRequest(new URL(path, 'https://www.example-school.test'));

afterEach(() => vi.unstubAllEnvs());

describe('proxy', () => {
  it('sets a CSP with a fresh nonce on every response and forwards it to the app', () => {
    const a = proxy(req('/'));
    const b = proxy(req('/'));
    const csp = a.headers.get('content-security-policy')!;
    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+'/);
    expect(csp).not.toBe(b.headers.get('content-security-policy'));
    expect(a.headers.get('x-middleware-request-x-nonce')).toBe(/'nonce-([^']+)'/.exec(csp)![1]);
  });

  it('marks admin responses private and noindex', () => {
    const res = proxy(req('/admin/overview'));
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('x-robots-tag')).toMatch(/noindex/);
    expect(proxy(req('/')).headers.get('cache-control')).toBeNull();
  });

  it('hides the admin area in production until authentication exists (Phase 1 guard)', () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    expect(proxy(req('/admin')).status).toBe(404);
    expect(proxy(req('/admin/news')).status).toBe(404);
    expect(proxy(req('/administration-policy')).status).not.toBe(404);
    expect(proxy(req('/')).status).toBe(200);
  });

  it('only blocks in the production environment', () => {
    expect(isAdminBlocked('/admin', 'preview')).toBe(false);
    expect(isAdminBlocked('/admin', undefined)).toBe(false);
    expect(isAdminBlocked('/admin/x', 'production')).toBe(true);
  });
});
