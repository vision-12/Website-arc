import { Suspense } from 'react';
import { AuthShell } from '@/features/auth/components/auth-shell';
import { LoginForm } from '@/features/auth/components/login-form';
import { safeNext } from '@/lib/auth/safe-next';

export const metadata = { title: 'Sign in' };

const NOTICES: Record<string, string> = {
  signedOut: 'You have signed out.',
  link: 'That link has expired or has already been used. Sign in, or ask for a new link.',
  inactive: 'Your account is not active. Ask your school administrator for help.',
};

async function LoginWithParams({
  searchParams,
}: {
  searchParams: PageProps<'/login'>['searchParams'];
}) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === 'string' ? params.next : undefined);
  const key = params.signedOut
    ? 'signedOut'
    : typeof params.error === 'string'
      ? params.error
      : undefined;
  return <LoginForm next={next} notice={key ? NOTICES[key] : undefined} />;
}

export default function LoginPage({ searchParams }: PageProps<'/login'>) {
  return (
    <AuthShell title="Sign in" description="Sign in to manage your school's website.">
      <Suspense fallback={<LoginForm next="/admin/overview" />}>
        <LoginWithParams searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
