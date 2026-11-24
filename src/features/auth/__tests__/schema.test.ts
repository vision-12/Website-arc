import { describe, expect, it } from 'vitest';
import {
  AcceptInviteInput,
  LoginInput,
  MfaCodeInput,
  NewPassword,
  ResetPasswordInput,
} from '../schema';

describe('auth form schemas (shared client/server)', () => {
  it('enforces the 12-character, letters-and-digits password rule (MP §7.5)', () => {
    expect(NewPassword.safeParse('short1').success).toBe(false);
    expect(NewPassword.safeParse('onlylettershere').success).toBe(false);
    expect(NewPassword.safeParse('123456789012345').success).toBe(false);
    expect(NewPassword.safeParse('kampala morning 2026').success).toBe(true);
  });

  it('normalises email addresses', () => {
    expect(LoginInput.parse({ email: ' Head@School.TEST ', password: 'x' }).email).toBe(
      'head@school.test',
    );
  });

  it('requires matching confirmation', () => {
    const r = ResetPasswordInput.safeParse({
      password: 'kampala morning 2026',
      confirm: 'different 2026 pass',
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(['confirm']);
    expect(
      AcceptInviteInput.safeParse({
        fullName: 'A',
        password: 'kampala morning 2026',
        confirm: 'kampala morning 2026',
      }).success,
    ).toBe(false);
  });

  it('accepts only 6-digit codes', () => {
    expect(MfaCodeInput.safeParse({ code: '123456' }).success).toBe(true);
    expect(MfaCodeInput.safeParse({ code: ' 123456 ' }).success).toBe(true);
    expect(MfaCodeInput.safeParse({ code: '12345a' }).success).toBe(false);
  });
});
