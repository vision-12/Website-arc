import { describe, expect, it } from 'vitest';
import { fail, ok } from '../result';

describe('Result helpers', () => {
  it('builds success and failure results', () => {
    expect(ok(1)).toEqual({ ok: true, data: 1 });
    expect(fail('FORBIDDEN', 'no')).toEqual({
      ok: false,
      error: { code: 'FORBIDDEN', message: 'no' },
    });
    expect(fail('VALIDATION', 'bad', { title: ['x'] })).toEqual({
      ok: false,
      error: { code: 'VALIDATION', message: 'bad', fieldErrors: { title: ['x'] } },
    });
  });
});
