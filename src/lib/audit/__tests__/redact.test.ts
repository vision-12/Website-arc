import { describe, expect, it } from 'vitest';
import { REDACTED, redact } from '../redact';

describe('audit redaction (MP §7.7)', () => {
  it('removes personal data at any depth but keeps the shape of the change', () => {
    const out = redact({
      before: { full_name: 'Ada', guardian_email: 'g@example.test', status: 'draft' },
      after: {
        answers: { allergies: 'nuts' },
        applicant_dob: '2014-01-01',
        items: [{ phone_e164: '+256700000000', label: 'x' }],
      },
      password: 'hunter2hunter2',
      ip: '10.0.0.1',
    });
    expect(out).toEqual({
      before: { full_name: 'Ada', guardian_email: REDACTED, status: 'draft' },
      after: {
        answers: REDACTED,
        applicant_dob: REDACTED,
        items: [{ phone_e164: REDACTED, label: 'x' }],
      },
      password: REDACTED,
      ip: REDACTED,
    });
  });

  it('passes primitives through unchanged', () => {
    expect(redact('x')).toBe('x');
    expect(redact(null)).toBeNull();
  });
});
