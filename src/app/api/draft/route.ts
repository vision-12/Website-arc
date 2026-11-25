import type { Route } from 'next';
import { draftMode } from 'next/headers';
import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { verifyDraftToken } from '@/features/content/draft-token';
import { can, getAccess } from '@/lib/auth/access';
import { serverEnv } from '@/lib/env/server';
import { createClient } from '@/lib/supabase/server';

const refuse = (message: string, status: number) =>
  new Response(message, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'private, no-store' },
  });

/**
 * Opens a draft preview (MP §5 Preview, spec §4.8 /api/draft). Needs a valid ten-minute token AND
 * the same person's live session with pages.view; then turns on draft mode and goes to the page.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? '';
  const access = await getAccess();
  if (!access)
    redirect(
      `/login?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}` as Route,
    );
  const checked = verifyDraftToken(token, serverEnv().PREVIEW_TOKEN_SECRET, {
    userId: access.userId,
  });
  if (!checked.ok)
    return refuse(
      checked.error === 'expired'
        ? 'This preview link has expired. Open the preview again from the page editor.'
        : 'This preview link does not work. Preview links work only for the person who opened them.',
      403,
    );
  if (!can(access, 'pages.view')) return refuse('You can’t preview website pages.', 403);

  const supabase = await createClient();
  const { data: page } = await supabase
    .from('pages')
    .select('path')
    .eq('id', checked.payload.i)
    .is('deleted_at', null)
    .maybeSingle();
  if (!page) return refuse('This page no longer exists. It may have been moved to Trash.', 404);

  (await draftMode()).enable();
  redirect(page.path as Route);
}
