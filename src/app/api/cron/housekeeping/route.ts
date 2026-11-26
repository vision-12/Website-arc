import { NextResponse, type NextRequest } from 'next/server';
import { z } from '@/lib/zod';
import { hasCronSecret } from '@/lib/security/cron-auth';
import { createAdminClient } from '@/lib/supabase/admin';

const Result = z.object({ orphan_media_objects: z.array(z.string()) }).loose();

/**
 * Hourly housekeeping (spec §4.8): expired rate-limit buckets and tickets, abandoned uploads, and
 * files no media row points at (rejected, replaced or abandoned uploads), removed through the
 * Storage API.
 */
export async function GET(request: NextRequest) {
  if (!hasCronSecret(request)) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('housekeeping');
  if (error) return NextResponse.json({ error: 'housekeeping_failed' }, { status: 500 });
  const parsed = Result.safeParse(data);
  const orphans = parsed.success ? parsed.data.orphan_media_objects : [];
  for (let i = 0; i < orphans.length; i += 100) {
    await admin.storage.from('media').remove(orphans.slice(i, i + 100));
  }
  return NextResponse.json(
    { ...(parsed.success ? parsed.data : {}), orphan_media_objects: orphans.length },
    { headers: { 'cache-control': 'no-store' } },
  );
}
