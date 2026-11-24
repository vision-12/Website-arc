import { Suspense } from 'react';
import { AuthShell } from '@/features/auth/components/auth-shell';
import { MfaChallengeForm } from '@/features/auth/components/simple-forms';
import { safeNext } from '@/lib/auth/safe-next';

export const metadata = { title: 'Confirm it is you' };

async function Challenge({ searchParams }: { searchParams: PageProps<'/mfa'>['searchParams'] }) {
  const params = await searchParams;
  return (
    <MfaChallengeForm next={safeNext(typeof params.next === 'string' ? params.next : undefined)} />
  );
}

export default function MfaPage({ searchParams }: PageProps<'/mfa'>) {
  return (
    <AuthShell
      title="Confirm it is you"
      description="Your account is protected with two-step sign-in."
    >
      <Suspense fallback={null}>
        <Challenge searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
