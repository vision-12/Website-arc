import { describe, expect, it } from 'vitest';
import { assertEnv, EnvError, parsePublicEnv, parseServerEnv } from '../schema';

const valid = {
  NEXT_PUBLIC_SITE_URL: 'https://www.example-school.test',
  NEXT_PUBLIC_SUPABASE_URL: 'https://abcd.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abc123',
  SCHOOL_SLUG: 'example-school',
  CRON_SECRET: 'c'.repeat(40),
  FORM_SIGNING_SECRET: 'f'.repeat(40),
  IP_HASH_SALT: 's'.repeat(40),
};

describe('environment validation', () => {
  it('accepts a minimal valid configuration', () => {
    expect(() => assertEnv(valid)).not.toThrow();
    expect(parsePublicEnv(valid).NEXT_PUBLIC_MAP_PROVIDER).toBe('osm');
  });

  it('lists every missing variable in one error', () => {
    try {
      assertEnv({});
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(EnvError);
      const issues = (e as EnvError).issues.join('\n');
      for (const key of [
        'NEXT_PUBLIC_SITE_URL',
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
        'SCHOOL_SLUG',
      ]) {
        expect(issues).toContain(key);
      }
    }
  });

  it('treats empty strings as unset', () => {
    expect(() => parsePublicEnv({ ...valid, NEXT_PUBLIC_SITE_URL: '' })).toThrow(
      /NEXT_PUBLIC_SITE_URL/,
    );
  });

  it('rejects legacy anon keys in the publishable slot', () => {
    expect(() =>
      parsePublicEnv({ ...valid, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'eyJhbGciOi...' }),
    ).toThrow(/publishable/);
  });

  it('refuses to expose a secret key through a NEXT_PUBLIC_ variable', () => {
    expect(() =>
      parsePublicEnv({ ...valid, NEXT_PUBLIC_MAP_PUBLIC_KEY: 'sb_secret_leak' }),
    ).toThrow(/never be exposed/);
  });

  it('requires https except for localhost', () => {
    expect(() =>
      parsePublicEnv({ ...valid, NEXT_PUBLIC_SITE_URL: 'http://www.example-school.test' }),
    ).toThrow(/https/);
    expect(() =>
      parsePublicEnv({ ...valid, NEXT_PUBLIC_SITE_URL: 'http://localhost:3000' }),
    ).not.toThrow();
  });

  it('validates secret shapes and lengths when present', () => {
    expect(() => parseServerEnv({ ...valid, SUPABASE_SECRET_KEY: 'service_role_jwt' })).toThrow(
      /SUPABASE_SECRET_KEY/,
    );
    expect(() => parseServerEnv({ ...valid, CRON_SECRET: 'short' })).toThrow(/at least 32/);
    expect(() => parseServerEnv({ ...valid, SCHOOL_SLUG: 'Bad Slug' })).toThrow(/SCHOOL_SLUG/);
  });
});
