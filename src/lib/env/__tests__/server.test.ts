import { afterEach, describe, expect, it, vi } from 'vitest';

const required = {
  CRON_SECRET: 'c'.repeat(40),
  FORM_SIGNING_SECRET: 'f'.repeat(40),
  IP_HASH_SALT: 's'.repeat(40),
  PREVIEW_TOKEN_SECRET: 'p'.repeat(40),
};
const stubRequired = () => Object.entries(required).forEach(([k, v]) => vi.stubEnv(k, v));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('serverEnv()', () => {
  it('parses process.env once and memoises the result', async () => {
    stubRequired();
    vi.stubEnv('SCHOOL_SLUG', 'demo-school');
    const { serverEnv } = await import('../server');
    const first = serverEnv();
    expect(first.SCHOOL_SLUG).toBe('demo-school');
    vi.stubEnv('SCHOOL_SLUG', 'changed');
    expect(serverEnv()).toBe(first);
  });

  it('throws a readable error when misconfigured', async () => {
    stubRequired();
    vi.stubEnv('SCHOOL_SLUG', '');
    const { serverEnv } = await import('../server');
    expect(() => serverEnv()).toThrow(/SCHOOL_SLUG/);
  });
});
