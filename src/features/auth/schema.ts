import { z } from 'zod';

/** Shared client/server validation for the sign-in screens (UK English, plain language). */
// Trim before validating: addresses pasted on phones often carry a trailing space.
const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email('Enter a valid email address, like name@school.ac'));

export const NewPassword = z
  .string()
  .min(12, 'Use at least 12 characters')
  .max(128, 'Use at most 128 characters')
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), 'Include at least one letter and one number');

export const LoginInput = z.object({
  email,
  password: z.string().min(1, 'Enter your password').max(128),
  next: z.string().max(512).optional(),
});

export const ForgotPasswordInput = z.object({ email });

export const ResetPasswordInput = z
  .object({ password: NewPassword, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    error: 'The two passwords do not match',
  });

export const AcceptInviteInput = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your full name').max(120),
    password: NewPassword,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    error: 'The two passwords do not match',
  });

export const MfaCodeInput = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app'),
  next: z.string().max(512).optional(),
});

export const MfaEnrolConfirmInput = MfaCodeInput.extend({ factorId: z.string().min(1).max(64) });

export const UpdateNameInput = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name').max(120),
});

export interface FormState {
  status: 'idle' | 'error' | 'success';
  message?: string;
  fieldErrors?: Record<string, string[]>;
  /** Non-secret values echoed back so React 19's post-action form reset keeps what was typed. */
  values?: Record<string, string>;
}

export const IDLE: FormState = { status: 'idle' };

export function fieldErrorsOf(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues)
    (out[issue.path.join('.') || '_form'] ??= []).push(issue.message);
  return out;
}
