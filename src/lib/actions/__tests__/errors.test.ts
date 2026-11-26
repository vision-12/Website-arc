import { describe, expect, it } from 'vitest';
import { z } from '@/lib/zod';
import { ForbiddenError, MfaRequiredError, UnauthenticatedError } from '@/lib/auth/errors';
import { ActionFailure, MESSAGES, toActionError } from '../errors';

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

describe('toActionError — specific, authored messages', () => {
  it('uses the plain-language DETAIL of our own VALIDATION raises', () => {
    const e = toActionError({
      code: '22023',
      message: 'VALIDATION',
      details: 'This page has sub-pages. Move them, or move them to Trash, first.',
    });
    expect(e).toEqual({
      code: 'VALIDATION',
      message: 'This page has sub-pages. Move them, or move them to Trash, first.',
    });
  });

  it('falls back to the generic message when there is no usable detail', () => {
    expect(toActionError({ code: '22023', message: 'VALIDATION' }).message).toBe(
      MESSAGES.VALIDATION,
    );
    expect(
      toActionError({ code: '22023', message: 'VALIDATION', details: 'x'.repeat(500) }).message,
    ).toBe(MESSAGES.VALIDATION);
  });

  it('passes ActionFailure through with its own message and field errors', () => {
    const e = toActionError(
      new ActionFailure('VALIDATION', 'Another page already uses this address.', {
        slug: ['Another page already uses this address.'],
      }),
    );
    expect(e).toEqual({
      code: 'VALIDATION',
      message: 'Another page already uses this address.',
      fieldErrors: { slug: ['Another page already uses this address.'] },
    });
    expect(toActionError(new ActionFailure('CONFLICT')).message).toBe(MESSAGES.CONFLICT);
  });
});
