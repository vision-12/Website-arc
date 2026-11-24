import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

/** Renders children only when the email link created a session; otherwise explains what to do. */
export async function SessionGate({
  expiredMessage,
  children,
}: {
  expiredMessage: string;
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims.sub) {
    return (
      <div className="space-y-4 text-sm">
        <p role="alert">{expiredMessage}</p>
        <p>
          <Link href="/forgot-password" className="font-medium underline underline-offset-4">
            Ask for a new link
          </Link>
        </p>
      </div>
    );
  }
  return children;
}
