import { describe, expect, it } from 'vitest';
import { checkForm, formValues, invalidState, keepValues } from '../form-state';
import { LoginInput, ResetPasswordInput } from '../schema';

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

describe('checkForm (the same schema in the browser and on the server)', () => {
  it('returns the error state for invalid input, so the form is not sent', () => {
    const state = checkForm(LoginInput, form({ email: 'not-an-email', password: '' }));

    expect(state?.status).toBe('error');
    expect(state?.message).toBe('Please check the highlighted fields.');
    expect(state?.fieldErrors?.email).toEqual(['Enter a valid email address, like name@school.ac']);
    expect(state?.fieldErrors?.password).toEqual(['Enter your password']);
    // What was typed comes back, secrets never do.
    expect(state?.values).toEqual({ email: 'not-an-email' });
  });

  it('returns null for valid input, which then goes to the server action', () => {
    const fd = form({ email: 'head@school.test', password: 'secret-password-1', next: '/admin' });
    expect(checkForm(LoginInput, fd)).toBeNull();
  });

  it('reports cross-field rules on the right field', () => {
    const state = checkForm(
      ResetPasswordInput,
      form({ password: 'kampala morning 2026', confirm: 'kampala morning 2025' }),
    );
    expect(state?.fieldErrors?.confirm).toEqual(['The two passwords do not match']);
    expect(state?.values).toEqual({});
  });
});

describe('form value helpers', () => {
  it('ignores files', () => {
    const fd = form({ email: 'a@b.test' });
    fd.append('upload', new Blob(['x']), 'x.txt');
    expect(formValues(fd)).toEqual({ email: 'a@b.test' });
  });

  it('never echoes passwords or codes, nor oversized values', () => {
    const fd = form({
      email: 'a@b.test',
      password: 'p',
      confirm: 'p',
      code: '123456',
      fullName: 'x'.repeat(255),
    });
    expect(keepValues(fd)).toEqual({ email: 'a@b.test' });
  });

  it('builds the error state the forms render', () => {
    expect(invalidState(form({ email: 'a@b.test' }), { email: ['Bad'] })).toEqual({
      status: 'error',
      message: 'Please check the highlighted fields.',
      fieldErrors: { email: ['Bad'] },
      values: { email: 'a@b.test' },
    });
  });
});
