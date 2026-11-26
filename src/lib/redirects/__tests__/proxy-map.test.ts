import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isContentPath, lookupRedirect, resetRedirectCache } from '../proxy-map';

const rows = (list: Array<[string, string, number?]>) =>
  list.map(([from_path, to_path, status_code = 308]) => ({ from_path, to_path, status_code }));

function mockFetch(...responses: Array<unknown[] | 'fail'>) {
  const fn = vi.fn((): Promise<Response> => {
    const next = responses.shift();
    if (next === 'fail' || next === undefined) return Promise.reject(new Error('offline'));
    return Promise.resolve(new Response(JSON.stringify(next), { status: 200 }));
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

beforeEach(() => resetRedirectCache());
afterEach(() => vi.unstubAllGlobals());

describe('isContentPath: where the proxy looks for redirects', () => {
  it.each(['/about', '/about/history', '/fees-2027', '/old-news-page'])('%s is content', (p) =>
    expect(isContentPath(p)).toBe(true),
  );
  it.each([
    '/',
    '/admin/pages',
    '/api/cron/publish',
    '/_next/static/x.js',
    '/preview/template/a',
    '/login',
    '/auth/confirm',
    '/logo.png',
    '/theme.css',
  ])('%s is not', (p) => expect(isContentPath(p)).toBe(false));
});

describe('lookupRedirect: an in-memory copy, refreshed every 30 s (plan P4-H)', () => {
  it('loads the table once and answers from memory', async () => {
    const fetch = mockFetch(rows([['/old-about', '/about']]));
    expect(await lookupRedirect('/old-about', 'http://db', 'key', 0)).toEqual({
      to: '/about',
      status: 308,
    });
    expect(await lookupRedirect('/nothing', 'http://db', 'key', 1_000)).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('refreshes in the background after 30 s, answering from the old copy meanwhile', async () => {
    const fetch = mockFetch(rows([['/a', '/b']]), rows([['/a', '/c']]));
    await lookupRedirect('/a', 'http://db', 'key', 0);
    expect(await lookupRedirect('/a', 'http://db', 'key', 31_000)).toEqual({
      to: '/b',
      status: 308,
    });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await new Promise((r) => setTimeout(r, 0));
    expect(await lookupRedirect('/a', 'http://db', 'key', 32_000)).toEqual({
      to: '/c',
      status: 308,
    });
  });

  it('keeps the last good copy when the database cannot be reached', async () => {
    mockFetch(rows([['/a', '/b']]), 'fail');
    await lookupRedirect('/a', 'http://db', 'key', 0);
    await lookupRedirect('/a', 'http://db', 'key', 40_000);
    await new Promise((r) => setTimeout(r, 0));
    expect(await lookupRedirect('/a', 'http://db', 'key', 41_000)).toEqual({
      to: '/b',
      status: 308,
    });
  });

  it('ignores status codes the table does not allow', async () => {
    mockFetch(rows([['/a', '/b', 200]]));
    expect(await lookupRedirect('/a', 'http://db', 'key', 0)).toBeNull();
  });
});
