import { describe, expect, it } from 'vitest';
import { DEFAULT_AFTER_LOGIN, safeNext } from '../safe-next';

describe('safeNext (open-redirect guard)', () => {
  it.each([
    ['/admin/news', '/admin/news'],
    ['/admin/news?page=2#top', '/admin/news?page=2#top'],
    ['/reset-password', '/reset-password'],
  ])('keeps same-origin path %s', (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });

  it.each([
    'https://evil.example/admin',
    '//evil.example/admin',
    '/\\evil.example',
    'javascript:alert(1)',
    'admin/news',
    '/admin\u0000/news',
    '',
    undefined,
    42,
    `/${'a'.repeat(600)}`,
  ])('rejects %s', (input) => {
    expect(safeNext(input)).toBe(DEFAULT_AFTER_LOGIN);
  });

  it('uses the supplied fallback', () => {
    expect(safeNext('//x', '/accept-invite')).toBe('/accept-invite');
  });
});
