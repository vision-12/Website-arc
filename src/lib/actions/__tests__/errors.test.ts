import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ForbiddenError, MfaRequiredError, UnauthenticatedError } from '@/lib/auth/errors';
import { MESSAGES, toActionError } from '../errors';

describe('toActionError — nothing raw reaches the browser', () => {
  it('maps validation errors to field errors', () => {
    const r = z.object({ title: z.string().min(2) }).safeParse({ title: 'x' });
    if (r.success) throw new Error('expected failure');
    const e = toActionError(r.error);
    expect(e.code).toBe('VALIDATION');
    expect(Object.keys(e.fieldErrors ?? {})).toEqual(['title']);
  });

  it.each([
    [new UnauthenticatedError(), 'UNAUTHENTICATED'],
    [new ForbiddenError('news.publish'), 'FORBIDDEN'],
    [new MfaRequiredError(), 'MFA_REQUIRED'],
    [{ code: '42501', message: 'TRANSITION_DENIED' }, 'TRANSITION_DENIED'],
    [{ code: '42501', message: 'ESCALATION_DENIED' }, 'ESCALATION_DENIED'],
    [{ code: 'P0001', message: 'LAST_SUPER_ADMIN' }, 'LAST_SUPER_ADMIN'],
    [{ code: '40001', message: 'CONFLICT' }, 'CONFLICT'],
    [{ code: 'PT429', message: 'RATE_LIMITED' }, 'RATE_LIMITED'],
    [
      { code: '42501', message: 'new row violates row-level security policy for table "pages"' },
      'FORBIDDEN',
    ],
    [
      { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
      'NOT_FOUND',
    ],
    [new Error('connect ECONNREFUSED 10.0.0.5:5432 password=secret'), 'INTERNAL'],
  ] as const)('%o → %s', (input, code) => {
    const e = toActionError(input);
    expect(e.code).toBe(code);
    expect(e.message).toBe(MESSAGES[code]);
    expect(e.message).not.toMatch(/row-level|ECONNREFUSED|password|PGRST|SQLSTATE/);
  });
});
