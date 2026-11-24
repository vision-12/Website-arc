import { Suspense } from 'react';
import { AuthShell } from '@/features/auth/components/auth-shell';
import { SessionGate } from '@/features/auth/components/session-gate';
import { ResetPasswordForm } from '@/features/auth/components/simple-forms';

export const metadata = { title: 'Choose a new password' };

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Choose a new password">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Checking your link…</p>}>
        <SessionGate expiredMessage="This reset link has expired or has already been used.">
          <ResetPasswordForm />
        </SessionGate>
      </Suspense>
    </AuthShell>
  );
}
