'use server';
import 'server-only';
import { redirect } from 'next/navigation';
import { publicEnv } from '@/lib/env/public';
import { safeNext } from '@/lib/auth/safe-next';
import { currentIpHash, hashEmail } from '@/lib/security/ip';
import { mintTicket } from '@/lib/security/ticket';
import { createClient, type TypedClient } from '@/lib/supabase/server';
import {
  AcceptInviteInput,
  fieldErrorsOf,
  ForgotPasswordInput,
  LoginInput,
  MfaCodeInput,
  MfaEnrolConfirmInput,
  ResetPasswordInput,
  type FormState,
} from './schema';
import { formValues, invalidState, keepValues } from './form-state';

/**
 * Sign-in flows (spec §4.7). These are the only actions without requirePermission: they establish
 * identity. Each is rate-limited through a ticket-gated RPC and returns generic messages.
 */

const GENERIC_LOGIN_ERROR = 'Email or password is incorrect.';
const RATE_LIMITED = 'Too many attempts. Please wait 15 minutes and try again.';
const SOMETHING_WRONG = 'Something went wrong. Please try again.';

async function allowAttempt(
  supabase: TypedClient,
  action: 'login' | 'reset',
  email: string,
): Promise<boolean | 'error'> {
  const payload = JSON.stringify({ action, emailHash: hashEmail(email) });
  const { data, error } = await supabase.rpc('rate_limit_check_auth', {
    p_ticket: { ...mintTicket('auth', payload, await currentIpHash()) },
    p_payload: payload,
  });
  if (error) return 'error';
  return data;
}

/** Where to send a freshly signed-in user: the MFA step if required, else their destination. */
async function afterSignIn(supabase: TypedClient, next: string): Promise<string> {
  const { data: access } = await supabase.rpc('my_access');
  const a = access as { requiresMfa?: boolean; mfaEnrolled?: boolean } | null;
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const nextParam = `?next=${encodeURIComponent(next)}`;
  if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') return `/mfa${nextParam}`;
  if (a?.requiresMfa && !a.mfaEnrolled) return `/mfa/setup${nextParam}`;
  return next;
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = LoginInput.safeParse(formValues(formData));
  if (!parsed.success) return invalidState(formData, fieldErrorsOf(parsed.error));
  const { email, password } = parsed.data;
  const next = safeNext(parsed.data.next);

  const supabase = await createClient();
  const allowed = await allowAttempt(supabase, 'login', email);
  if (allowed === 'error')
    return { status: 'error', message: SOMETHING_WRONG, values: keepValues(formData) };
  if (!allowed) return { status: 'error', message: RATE_LIMITED, values: keepValues(formData) };

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { status: 'error', message: GENERIC_LOGIN_ERROR, values: keepValues(formData) };

  // Invited-but-not-accepted and deactivated accounts cannot sign in (same generic message).
  const { data: access } = await supabase.rpc('my_access');
  if ((access as { status?: string } | null)?.status !== 'active') {
    await supabase.auth.signOut();
    return { status: 'error', message: GENERIC_LOGIN_ERROR, values: keepValues(formData) };
  }
  await supabase.rpc('record_login');
  redirect((await afterSignIn(supabase, next)) as never);
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login?signedOut=1');
}

const RESET_SENT =
  'If an account exists for that address, we have sent a link to reset the password. Check your email.';

export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = ForgotPasswordInput.safeParse(formValues(formData));
  if (!parsed.success) return invalidState(formData, fieldErrorsOf(parsed.error));
  const supabase = await createClient();
  const allowed = await allowAttempt(supabase, 'reset', parsed.data.email);
  if (allowed === 'error') return { status: 'error', message: SOMETHING_WRONG };
  if (!allowed) return { status: 'error', message: RATE_LIMITED };
  // The result is ignored on purpose: the response never reveals whether the address exists.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: new URL(
      '/auth/confirm?next=/reset-password',
      publicEnv.NEXT_PUBLIC_SITE_URL,
    ).toString(),
  });
  return { status: 'success', message: RESET_SENT };
}

function passwordError(code: string | undefined): string {
  if (code === 'weak_password')
    return 'This password is too easy to guess or has appeared in a data breach. Choose another.';
  if (code === 'same_password') return 'Choose a password you have not used before.';
  return SOMETHING_WRONG;
}

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = ResetPasswordInput.safeParse(formValues(formData));
  if (!parsed.success) return invalidState(formData, fieldErrorsOf(parsed.error));
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims.sub)
    return { status: 'error', message: 'This reset link has expired. Please ask for a new one.' };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { status: 'error', message: passwordError(error.code) };
  await supabase.rpc('log_activity', {
    p_action: 'auth.password_reset',
    p_summary: 'Reset their password',
  });
  redirect((await afterSignIn(supabase, '/admin/overview')) as never);
}

export async function acceptInvite(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = AcceptInviteInput.safeParse(formValues(formData));
  if (!parsed.success) return invalidState(formData, fieldErrorsOf(parsed.error));
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims.sub)
    return {
      status: 'error',
      message: 'This invitation link has expired. Ask your administrator to send a new one.',
    };
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
    data: { full_name: parsed.data.fullName },
  });
  if (error)
    return { status: 'error', message: passwordError(error.code), values: keepValues(formData) };
  const { error: rpcError } = await supabase.rpc('accept_invite', {
    p_full_name: parsed.data.fullName,
  });
  if (rpcError)
    return {
      status: 'error',
      message: 'This invitation has already been used. Try signing in instead.',
      values: keepValues(formData),
    };
  redirect((await afterSignIn(supabase, '/admin/overview')) as never);
}

const BAD_CODE =
  "That code didn't work. Codes change every 30 seconds — check your device's clock and try the newest one.";

export async function verifyMfa(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = MfaCodeInput.safeParse(formValues(formData));
  if (!parsed.success) return invalidState(formData, fieldErrorsOf(parsed.error));
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp[0]; // verified factors only
  if (!factor)
    redirect(`/mfa/setup?next=${encodeURIComponent(safeNext(parsed.data.next))}` as never);
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code: parsed.data.code,
  });
  if (error) return { status: 'error', message: BAD_CODE };
  redirect(safeNext(parsed.data.next) as never);
}

export interface EnrolmentStart {
  ok: boolean;
  factorId?: string;
  qrCode?: string;
  secret?: string;
  message?: string;
}

/** Starts TOTP enrolment: removes abandoned unverified factors, returns the QR code and manual key. */
export async function startMfaEnrolment(): Promise<EnrolmentStart> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims.sub) return { ok: false, message: 'Please sign in again.' };
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? [])
    if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `Authenticator ${Date.now()}`,
  });
  if (error) return { ok: false, message: SOMETHING_WRONG };
  return { ok: true, factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

export async function confirmMfaEnrolment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = MfaEnrolConfirmInput.safeParse(formValues(formData));
  if (!parsed.success) return invalidState(formData, fieldErrorsOf(parsed.error));
  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: parsed.data.factorId,
    code: parsed.data.code,
  });
  if (error) return { status: 'error', message: BAD_CODE };
  await supabase.rpc('log_activity', {
    p_action: 'auth.mfa_enrolled',
    p_summary: 'Set up an authenticator app',
  });
  redirect(safeNext(parsed.data.next) as never);
}
