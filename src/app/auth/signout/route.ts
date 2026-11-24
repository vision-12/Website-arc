import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** Used by the admin shell when an account has been deactivated mid-session. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const reason =
    request.nextUrl.searchParams.get('reason') === 'inactive' ? 'inactive' : 'signedOut';
  const url = new URL('/login', request.url);
  if (reason === 'inactive') url.searchParams.set('error', 'inactive');
  else url.searchParams.set('signedOut', '1');
  return NextResponse.redirect(url);
}
