import { AuthShell } from '@/features/auth/components/auth-shell';
import { LoginForm } from '@/features/auth/components/login-form';

export const metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <AuthShell title="Sign in" description="Sign in to manage your school's website.">
      <LoginForm />
    </AuthShell>
  );
}
