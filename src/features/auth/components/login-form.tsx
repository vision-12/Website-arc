'use client';
import { useActionState } from 'react';
import Link from 'next/link';
import { useSearchParam } from '@/hooks/use-search-param';
import { safeNext } from '@/lib/auth/safe-next';
import { login } from '../actions';
import { IDLE, LoginInput, type FormState } from '../schema';
import { Field, FormMessage, SubmitButton } from './form-parts';
import { useClientCheck } from './use-client-check';

const NOTICES: Record<string, string> = {
  signedOut: 'You have signed out.',
  link: 'That link has expired or has already been used. Sign in, or ask for a new link.',
  inactive: 'Your account is not active. Ask your school administrator for help.',
};

/** Rendered once (no Suspense swap), so nothing typed before the page finishes loading is lost. */
export function LoginForm() {
  const [serverState, action] = useActionState(login, IDLE);
  const { clientState, onSubmit } = useClientCheck(LoginInput);
  const state = clientState ?? serverState;
  const next = safeNext(useSearchParam('next'));
  const signedOut = useSearchParam('signedOut');
  const error = useSearchParam('error');
  const noticeKey = signedOut ? 'signedOut' : error;
  const notice = noticeKey ? NOTICES[noticeKey] : undefined;
  const shown: FormState =
    state.status === 'idle' && notice ? { status: 'success', message: notice } : state;

  return (
    <form action={action} onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormMessage state={shown} />
      <input type="hidden" name="next" value={next} />
      <Field
        name="email"
        label="Email address"
        type="email"
        autoComplete="username"
        errors={state.fieldErrors?.email}
        defaultValue={state.values?.email ?? ''}
      />
      <Field
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        errors={state.fieldErrors?.password}
      />
      <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
      <p className="text-center text-sm">
        <Link href="/forgot-password" className="font-medium underline underline-offset-4">
          Forgotten your password?
        </Link>
      </p>
    </form>
  );
}
