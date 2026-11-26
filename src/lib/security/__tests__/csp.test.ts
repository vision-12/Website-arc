import { describe, expect, it } from 'vitest';
import { buildCsp, createNonce } from '../csp';

const parse = (csp: string): Record<string, string[] | undefined> =>
  Object.fromEntries(
    csp.split('; ').map((d): [string, string[]] => {
      const [k = '', ...v] = d.split(' ');
      return [k, v];
    }),
  );

describe('buildCsp', () => {
  const nonce = createNonce();
  const prod = parse(buildCsp({ nonce, supabaseUrl: 'https://abcd.supabase.co' }));

  it('binds scripts and style elements to the per-request nonce', () => {
    expect(prod['script-src']).toContain(`'nonce-${nonce}'`);
    expect(prod['style-src-elem']).toContain(`'nonce-${nonce}'`);
  });

  it('never allows unsafe-inline or unsafe-eval for scripts in production', () => {
    expect(prod['script-src']).not.toContain("'unsafe-inline'");
    expect(prod['script-src']).not.toContain("'unsafe-eval'");
    expect(prod['style-src-elem']).not.toContain("'unsafe-inline'");
  });

  it('locks down framing, base URI, objects and form targets', () => {
    expect(prod['frame-ancestors']).toEqual(["'none'"]);
    expect(prod['base-uri']).toEqual(["'none'"]);
    expect(prod['object-src']).toEqual(["'none'"]);
    expect(prod['form-action']).toEqual(["'self'"]);
    expect(prod['upgrade-insecure-requests']).toBeDefined();
  });

  it('lets only this site frame the template preview (spec §6.4)', () => {
    const preview = parse(
      buildCsp({ nonce, supabaseUrl: 'https://abcd.supabase.co', frameAncestors: 'self' }),
    );
    expect(preview['frame-ancestors']).toEqual(["'self'"]);
  });

  it('allows the Supabase origin for images, media and connections only', () => {
    expect(prod['img-src']).toContain('https://abcd.supabase.co');
    expect(prod['connect-src']).toEqual(
      expect.arrayContaining(['https://abcd.supabase.co', 'wss://abcd.supabase.co']),
    );
    expect(prod['script-src']).not.toContain('https://abcd.supabase.co');
  });

  it('adds only development conveniences in dev', () => {
    const dev = parse(buildCsp({ nonce, supabaseUrl: 'http://127.0.0.1:54321', isDev: true }));
    expect(dev['script-src']).toContain("'unsafe-eval'");
    expect(dev['upgrade-insecure-requests']).toBeUndefined();
  });

  it('lets WebAssembly compile only where asked (admin HEIC conversion, ADR-018), never string eval', () => {
    const admin = parse(
      buildCsp({ nonce, supabaseUrl: 'https://abcd.supabase.co', allowWasm: true }),
    );
    expect(admin['script-src']).toContain("'wasm-unsafe-eval'");
    expect(admin['script-src']).not.toContain("'unsafe-eval'");
    expect(prod['script-src']).not.toContain("'wasm-unsafe-eval'");
  });

  it('rejects a missing nonce', () => {
    expect(() => buildCsp({ nonce: '', supabaseUrl: 'https://abcd.supabase.co' })).toThrow(/nonce/);
  });

  it('creates unique 128-bit nonces', () => {
    const nonces = new Set(Array.from({ length: 200 }, createNonce));
    expect(nonces.size).toBe(200);
    expect(atob(createNonce())).toHaveLength(16);
  });
});
