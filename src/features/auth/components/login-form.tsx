'use client';
import { useActionState } from 'react';
import Link from 'next/link';
import { login } from '../actions';
import { IDLE } from '../schema';
import { Field, FormMessage, SubmitButton } from './form-parts';

export function LoginForm({ next, notice }: { next: string; notice?: string | undefined }) {
  const [state, action] = useActionState(
    login,
    notice ? { status: 'success' as const, message: notice } : IDLE,
  );
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
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
