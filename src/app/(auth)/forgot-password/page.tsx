import { AuthShell } from '@/features/auth/components/auth-shell';
import { ForgotPasswordForm } from '@/features/auth/components/simple-forms';

export const metadata = { title: 'Reset your password' };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      description="Enter the email address you use to sign in. We will email you a link to choose a new password."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
