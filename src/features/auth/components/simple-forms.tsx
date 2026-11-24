'use client';
import { useActionState } from 'react';
import Link from 'next/link';
import { useSearchParam } from '@/hooks/use-search-param';
import { safeNext } from '@/lib/auth/safe-next';
import { acceptInvite, requestPasswordReset, resetPassword, verifyMfa } from '../actions';
import {
  AcceptInviteInput,
  ForgotPasswordInput,
  IDLE,
  MfaCodeInput,
  ResetPasswordInput,
} from '../schema';
import { Field, FormMessage, SubmitButton } from './form-parts';
import { useClientCheck } from './use-client-check';

// Each form is checked in the browser with its action's own schema, then again on the server.

const PASSWORD_HINT =
  'At least 12 characters, with a letter and a number. A short sentence is easy to remember.';

export function ForgotPasswordForm() {
  const [serverState, action] = useActionState(requestPasswordReset, IDLE);
  const { clientState, onSubmit } = useClientCheck(ForgotPasswordInput);
  const state = clientState ?? serverState;
  return (
    <form action={action} onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field
        name="email"
        label="Email address"
        type="email"
        autoComplete="username"
        errors={state.fieldErrors?.email}
        defaultValue={state.values?.email ?? ''}
      />
      <SubmitButton pendingLabel="Sending…">Send reset link</SubmitButton>
      <p className="text-center text-sm">
        <Link href="/login" className="font-medium underline underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm() {
  const [serverState, action] = useActionState(resetPassword, IDLE);
  const { clientState, onSubmit } = useClientCheck(ResetPasswordInput);
  const state = clientState ?? serverState;
  return (
    <form action={action} onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field
        name="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        hint={PASSWORD_HINT}
        errors={state.fieldErrors?.password}
      />
      <Field
        name="confirm"
        label="Type the new password again"
        type="password"
        autoComplete="new-password"
        errors={state.fieldErrors?.confirm}
      />
      <SubmitButton pendingLabel="Saving…">Save new password</SubmitButton>
    </form>
  );
}

export function AcceptInviteForm({ defaultName }: { defaultName: string }) {
  const [serverState, action] = useActionState(acceptInvite, IDLE);
  const { clientState, onSubmit } = useClientCheck(AcceptInviteInput);
  const state = clientState ?? serverState;
  return (
    <form action={action} onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field
        name="fullName"
        label="Your full name"
        autoComplete="name"
        defaultValue={state.values?.fullName ?? defaultName}
        errors={state.fieldErrors?.fullName}
      />
      <Field
        name="password"
        label="Choose a password"
        type="password"
        autoComplete="new-password"
        hint={PASSWORD_HINT}
        errors={state.fieldErrors?.password}
      />
      <Field
        name="confirm"
        label="Type the password again"
        type="password"
        autoComplete="new-password"
        errors={state.fieldErrors?.confirm}
      />
      <SubmitButton pendingLabel="Setting up…">Set up my account</SubmitButton>
    </form>
  );
}

export function MfaChallengeForm() {
  const [serverState, action] = useActionState(verifyMfa, IDLE);
  const { clientState, onSubmit } = useClientCheck(MfaCodeInput);
  const state = clientState ?? serverState;
  const next = safeNext(useSearchParam('next'));
  return (
    <form action={action} onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="next" value={next} />
      <Field
        name="code"
        label="6-digit code"
        inputMode="numeric"
        autoComplete="one-time-code"
        hint="Open your authenticator app and type the code shown for this website."
        errors={state.fieldErrors?.code}
      />
      <SubmitButton pendingLabel="Checking…">Continue</SubmitButton>
    </form>
  );
}
