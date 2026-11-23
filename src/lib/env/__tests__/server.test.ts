import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('serverEnv()', () => {
  it('parses process.env once and memoises the result', async () => {
    vi.stubEnv('SCHOOL_SLUG', 'demo-school');
    const { serverEnv } = await import('../server');
    const first = serverEnv();
    expect(first.SCHOOL_SLUG).toBe('demo-school');
    vi.stubEnv('SCHOOL_SLUG', 'changed');
    expect(serverEnv()).toBe(first);
  });

  it('throws a readable error when misconfigured', async () => {
    vi.stubEnv('SCHOOL_SLUG', '');
    const { serverEnv } = await import('../server');
    expect(() => serverEnv()).toThrow(/SCHOOL_SLUG/);
  });
});
