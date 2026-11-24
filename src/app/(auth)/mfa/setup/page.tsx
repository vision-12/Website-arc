import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/features/auth/components/auth-shell';
import { MfaSetup } from '@/features/auth/components/mfa-setup';
import { safeNext } from '@/lib/auth/safe-next';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Set up two-step sign-in' };

async function Setup({ searchParams }: { searchParams: PageProps<'/mfa/setup'>['searchParams'] }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims.sub) redirect('/login?next=/mfa/setup');
  const params = await searchParams;
  return <MfaSetup next={safeNext(typeof params.next === 'string' ? params.next : undefined)} />;
}

export default function MfaSetupPage({ searchParams }: PageProps<'/mfa/setup'>) {
  return (
    <AuthShell
      title="Set up two-step sign-in"
      description="Your role can see personal information, so signing in needs a code from your phone as well as your password."
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Setup searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
