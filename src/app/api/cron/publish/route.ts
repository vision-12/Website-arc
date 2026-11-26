import { revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { CacheTags } from '@/lib/cache/tags';
import { hasCronSecret } from '@/lib/security/cron-auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Scheduled publishing (MP §5, spec §4.8): a Vercel Schedule calls this every 5 minutes with
 * `Authorization: Bearer CRON_SECRET` (plan P4-I). Due items go live in one database call, which
 * also audits them; their cache tags expire immediately, so the next visitor sees them.
 */
export async function GET(request: NextRequest) {
  if (!hasCronSecret(request)) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const { data, error } = await createAdminClient().rpc('publish_due_content');
  if (error) return NextResponse.json({ error: 'publish_failed' }, { status: 500 });

  const tags = new Set<string>();
  for (const item of data) {
    if (item.entity_table === 'pages') {
      tags.add(CacheTags.pages);
      tags.add(CacheTags.page(item.path));
    }
  }
  if (tags.size > 0) tags.add(CacheTags.sitemap);
  for (const tag of tags) revalidateTag(tag, { expire: 0 });

  return NextResponse.json(
    { published: data.length },
    { headers: { 'cache-control': 'no-store' } },
  );
}
