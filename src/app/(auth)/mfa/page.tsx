import { AuthShell } from '@/features/auth/components/auth-shell';
import { MfaChallengeForm } from '@/features/auth/components/simple-forms';

export const metadata = { title: 'Confirm it is you' };

export default function MfaPage() {
  return (
    <AuthShell
      title="Confirm it is you"
      description="Your account is protected with two-step sign-in."
    >
      <MfaChallengeForm />
    </AuthShell>
  );
}
