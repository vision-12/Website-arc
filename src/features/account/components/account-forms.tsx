'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { toast } from '@/components/ui/toast';
import { useHydrated } from '@/hooks/use-hydrated';
import { fieldErrorsOf, UpdateNameInput } from '@/features/auth/schema';
import { removeAuthenticator, sendOwnPasswordReset, updateOwnName } from '../actions';

export function NameForm({ fullName }: { fullName: string }) {
  const [value, setValue] = useState(fullName);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const hydrated = useHydrated();
  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        // Same schema as the action: answer a mistake at once, without a request.
        const parsed = UpdateNameInput.safeParse({ fullName: value });
        if (!parsed.success) {
          setError(fieldErrorsOf(parsed.error).fullName?.join(' ') ?? 'Please check your name.');
          return;
        }
        start(async () => {
          const result = await updateOwnName({ fullName: value });
          if (result.ok) {
            setError(null);
            toast.success('Your name has been updated');
          } else {
            setError(result.error.fieldErrors?.fullName?.join(' ') ?? result.error.message);
          }
        });
      }}
    >
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="fullName">Your name</Label>
        <Input
          id="fullName"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="name"
          aria-invalid={error ? true : undefined}
          {...(error ? { 'aria-describedby': 'fullName-error' } : {})}
        />
        {error ? (
          <p id="fullName-error" className="text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      <Button type="submit" disabled={!hydrated || pending || value.trim() === fullName}>
        {pending ? 'Saving…' : 'Save name'}
      </Button>
    </form>
  );
}

export function PasswordResetButton() {
  const [pending, start] = useTransition();
  const hydrated = useHydrated();
  return (
    <Button
      variant="outline"
      disabled={!hydrated || pending}
      onClick={() =>
        start(async () => {
          const r = await sendOwnPasswordReset({});
          if (r.ok)
            toast.success('Check your email', 'We have sent you a link to choose a new password.');
          else toast.error(r.error.message);
        })
      }
    >
      {pending ? 'Sending…' : 'Email me a password reset link'}
    </Button>
  );
}

export function AuthenticatorControls({
  factorId,
  required,
}: {
  factorId: string | null;
  required: boolean;
}) {
  if (!factorId) {
    return (
      <Button asChild>
        <Link href="/mfa/setup?next=/admin/account">Set up an authenticator app</Link>
      </Button>
    );
  }
  if (required) {
    return (
      <p className="text-sm text-muted-foreground">
        Your role requires two-step sign-in, so it can&apos;t be turned off.
      </p>
    );
  }
  return (
    <ConfirmDialog
      trigger={<Button variant="outline">Turn off two-step sign-in</Button>}
      title="Turn off two-step sign-in?"
      description="Your account will be protected by your password only. You can set it up again at any time."
      confirmLabel="Turn it off"
      destructive
      onConfirm={async () => {
        const r = await removeAuthenticator({ factorId });
        if (r.ok) toast.success('Two-step sign-in is off');
        else toast.error(r.error.message);
      }}
    />
  );
}
