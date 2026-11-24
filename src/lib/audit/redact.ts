/** Keys whose values never enter the audit log (spec §4.0, MP §7.7). Matched case-insensitively. */
const SENSITIVE = [
  /^guardian_/,
  /^applicant_/,
  /email/,
  /phone/,
  /^answers$/,
  /^message$/,
  /medical/,
  /password/,
  /token/,
  /secret/,
  /^body$/,
  /^ip$/,
  /address/,
  /dob/,
  /birth/,
];

export const REDACTED = '[redacted]';

/** Deep copy with sensitive values replaced; structure is kept so diffs still show *what* changed. */
export function redact<T>(value: T): T {
  if (Array.isArray(value)) return (value as unknown[]).map((v): unknown => redact(v)) as T;
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE.some((re) => re.test(k.toLowerCase())) ? REDACTED : redact(v);
    }
    return out as T;
  }
  return value;
}
