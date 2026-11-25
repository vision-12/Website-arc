import { z } from 'zod';
import { ForbiddenError, MfaRequiredError, UnauthenticatedError } from '@/lib/auth/errors';
import type { ActionError, ErrorCode } from './result';

/** Plain-language messages (MP §11). Raw database or library messages never reach the browser. */
export const MESSAGES: Record<ErrorCode, string> = {
  VALIDATION: 'Please check the highlighted fields.',
  UNAUTHENTICATED: 'Please sign in to continue.',
  FORBIDDEN: "You don't have permission to do that. Ask your administrator if you need it.",
  MFA_REQUIRED: 'Please confirm it is you with your authenticator app.',
  NOT_FOUND: 'We could not find that item. It may have been deleted.',
  CONFLICT: 'Someone else edited this — reload to see their changes.',
  RATE_LIMITED: 'Too many attempts. Please wait a few minutes and try again.',
  BOT_DETECTED: 'We could not process that request. Please try again.',
  TRANSITION_DENIED: "You can't make that change. You may need someone with approval rights.",
  FEATURED_LIMIT: 'Too many items are already featured. Unfeature one first.',
  MEDIA_IN_USE: 'This file is used on the website. Replace it instead of deleting it.',
  ALT_TEXT_REQUIRED: 'Add a photo description before using this image.',
  ESCALATION_DENIED: 'You can only give people roles with permissions you have yourself.',
  LAST_SUPER_ADMIN: 'At least one active Super Administrator must remain.',
  INTAKE_CLOSED: 'Applications for this intake are closed.',
  UPLOAD_REJECTED: "This file couldn't be checked. Please upload a PDF, JPG or PNG.",
  CONTRAST_TOO_LOW: 'These colours are hard to read together.',
  INTERNAL: 'Something went wrong on our side. Please try again.',
};

const DB_MESSAGE_CODES: ReadonlySet<string> = new Set([
  'TRANSITION_DENIED',
  'ESCALATION_DENIED',
  'LAST_SUPER_ADMIN',
  'FEATURED_LIMIT',
  'MEDIA_IN_USE',
  'ALT_TEXT_REQUIRED',
  'RATE_LIMITED',
  'CONFLICT',
  'FORBIDDEN',
  'VALIDATION',
  'INTAKE_CLOSED',
]);

interface PgLikeError {
  code?: string;
  message?: string;
  details?: string | null;
}

/**
 * Thrown by action handlers to fail with a specific code, optionally with a plain-language message
 * written for that case (never a raw error text).
 */
export class ActionFailure extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly userMessage?: string,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(code);
    this.name = 'ActionFailure';
  }
}

/** Our own database raises put a plain-language explanation in DETAIL (e.g. "Pages can be nested…"). */
const authoredDetail = (e: PgLikeError): string | null =>
  typeof e.details === 'string' && e.details.length > 0 && e.details.length <= 240
    ? e.details
    : null;

const isPgLike = (e: unknown): e is PgLikeError =>
  typeof e === 'object' &&
  e !== null &&
  ('code' in e || 'message' in e) &&
  !(e instanceof Error && !('code' in e));

function from(code: ErrorCode): ActionError {
  return { code, message: MESSAGES[code] };
}

/** Maps anything thrown inside an action to a safe, typed error. */
export function toActionError(error: unknown): ActionError {
  if (error instanceof z.ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const key = issue.path.join('.') || '_form';
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { code: 'VALIDATION', message: MESSAGES.VALIDATION, fieldErrors };
  }
  if (error instanceof UnauthenticatedError) return from('UNAUTHENTICATED');
  if (error instanceof ForbiddenError) return from('FORBIDDEN');
  if (error instanceof MfaRequiredError) return from('MFA_REQUIRED');
  if (error instanceof ActionFailure) {
    return {
      code: error.code,
      message: error.userMessage ?? MESSAGES[error.code],
      ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
    };
  }
  if (isPgLike(error)) {
    if (error.message === 'VALIDATION') {
      const detail = authoredDetail(error);
      return detail ? { code: 'VALIDATION', message: detail } : from('VALIDATION');
    }
    if (error.message && DB_MESSAGE_CODES.has(error.message))
      return from(error.message as ErrorCode);
    switch (error.code) {
      case '40001':
        return from('CONFLICT');
      case 'PT429':
        return from('RATE_LIMITED');
      case '42501':
        return from('FORBIDDEN');
      case '23514':
      case '22023':
        return from('VALIDATION');
      case 'PGRST116':
        return from('NOT_FOUND');
    }
  }
  return from('INTERNAL');
}
