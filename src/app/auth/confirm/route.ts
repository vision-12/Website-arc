import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { safeNext } from '@/lib/auth/safe-next';
import { createClient } from '@/lib/supabase/server';

const ALLOWED: readonly EmailOtpType[] = ['invite', 'recovery', 'email', 'email_change'];
const isAllowedType = (v: string | null): v is EmailOtpType =>
  v !== null && (ALLOWED as readonly string[]).includes(v);

/**
 * Email links (invite, password reset) land here with a one-time token_hash. Verifying it creates the
 * session server-side, so the link works on any device (no PKCE verifier needed).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get('token_hash');
  const rawType = searchParams.get('type');
  const type = isAllowedType(rawType) ? rawType : null;
  const fallback =
    type === 'invite'
      ? '/accept-invite'
      : type === 'recovery'
        ? '/reset-password'
        : '/admin/overview';
  const next = safeNext(searchParams.get('next'), fallback);

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(new URL('/login?error=link', request.url));
}
