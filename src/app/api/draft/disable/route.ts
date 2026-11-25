import type { Route } from 'next';
import { draftMode } from 'next/headers';
import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { safeNext } from '@/lib/auth/safe-next';

/** Leaves draft preview and goes back (same-origin paths only). */
export async function GET(request: NextRequest) {
  (await draftMode()).disable();
  redirect(safeNext(request.nextUrl.searchParams.get('next'), '/') as Route);
}
