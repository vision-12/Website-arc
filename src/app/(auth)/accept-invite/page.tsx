import { Suspense } from 'react';
import { AuthShell } from '@/features/auth/components/auth-shell';
import { SessionGate } from '@/features/auth/components/session-gate';
import { AcceptInviteForm } from '@/features/auth/components/simple-forms';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Set up your account' };

async function InviteForm() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const name =
    typeof data?.claims.user_metadata?.full_name === 'string'
      ? data.claims.user_metadata.full_name
      : '';
  return <AcceptInviteForm defaultName={name} />;
}

export default function AcceptInvitePage() {
  return (
    <AuthShell
      title="Set up your account"
      description="You have been invited to help manage the school website. Confirm your name and choose a password."
    >
      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Checking your invitation…</p>}
      >
        <SessionGate expiredMessage="This invitation link has expired or has already been used. Ask your administrator to send a new one.">
          <InviteForm />
        </SessionGate>
      </Suspense>
    </AuthShell>
  );
}
