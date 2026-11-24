export type ErrorCode =
  | 'VALIDATION'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'MFA_REQUIRED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'BOT_DETECTED'
  | 'TRANSITION_DENIED'
  | 'FEATURED_LIMIT'
  | 'MEDIA_IN_USE'
  | 'ALT_TEXT_REQUIRED'
  | 'ESCALATION_DENIED'
  | 'LAST_SUPER_ADMIN'
  | 'INTAKE_CLOSED'
  | 'UPLOAD_REJECTED'
  | 'CONTRAST_TOO_LOW'
  | 'INTERNAL';

export interface ActionError {
  code: ErrorCode;
  message: string;
  fieldErrors?: Record<string, string[]>;
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: ActionError };

export const ok = <T>(data: T): Result<T> => ({ ok: true, data });
export const fail = (
  code: ErrorCode,
  message: string,
  fieldErrors?: Record<string, string[]>,
): Result<never> => ({
  ok: false,
  error: fieldErrors ? { code, message, fieldErrors } : { code, message },
});
