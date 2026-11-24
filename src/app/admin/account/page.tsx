import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AuthenticatorControls,
  NameForm,
  PasswordResetButton,
} from '@/features/account/components/account-forms';
import { getAccess } from '@/lib/auth/access';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Your account' };

export default async function AccountPage() {
  const access = await getAccess();
  if (!access) redirect('/login?next=/admin/account');
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = factors?.totp[0] ?? null; // listFactors().totp contains verified factors only;

  return (
    <>
      <PageHeader title="Your account" description={`Signed in as ${access.email}`} />
      <div className="grid max-w-2xl gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Your details</CardTitle>
            <CardDescription>
              Your role: {access.roles.join(', ') || 'none'}. Ask an administrator to change it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NameForm fullName={access.fullName} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
            <CardDescription>
              For your security, we email you a link to choose a new password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordResetButton />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Two-step sign-in</CardTitle>
            <CardDescription>
              {verified
                ? 'On — you sign in with your password and a code from your authenticator app.'
                : 'Off — you sign in with your password only.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AuthenticatorControls factorId={verified?.id ?? null} required={access.requiresMfa} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
