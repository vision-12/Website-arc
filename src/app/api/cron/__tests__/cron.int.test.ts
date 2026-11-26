import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { Client } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminClient, anonClient } from '../../../../../test/support/supabase';
import { expiredTags } from '../../../../../test/support/actions';

vi.mock('next/cache', async () =>
  (await import('../../../../../test/support/actions')).cacheMock(),
);

const publish = await import('../publish/route');
const housekeeping = await import('../housekeeping/route');

const call = (
  handler: (r: NextRequest) => Promise<Response>,
  path: string,
  secret = process.env.CRON_SECRET,
) =>
  handler(
    new NextRequest(`http://localhost${path}`, { headers: { authorization: `Bearer ${secret}` } }),
  );

beforeEach(() => {
  expiredTags.length = 0;
});

describe('/api/cron/publish (MP §5 scheduled publishing, plan P4-I)', () => {
  it('refuses callers without the secret', async () => {
    expect((await call(publish.GET, '/api/cron/publish', 'wrong')).status).toBe(401);
    expect((await publish.GET(new NextRequest('http://localhost/api/cron/publish'))).status).toBe(
      401,
    );
  });

  it('publishes due pages, expires their cache tags, and visitors can see them', async () => {
    const admin = adminClient();
    const slug = `due-${randomUUID().slice(0, 8)}`;
    const { data: page } = await admin
      .from('pages')
      .insert({
        title: 'Sports day',
        slug,
        status: 'scheduled',
        publish_at: new Date(Date.now() - 1000).toISOString(),
      })
      .select('id')
      .single();
    expect((await anonClient().from('pages').select('id').eq('id', page!.id)).data).toEqual([]);

    const res = await call(publish.GET, '/api/cron/publish');
    expect(res.status).toBe(200);
    expect(((await res.json()) as { published: number }).published).toBeGreaterThanOrEqual(1);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(expiredTags).toEqual(expect.arrayContaining(['pages', `page:/${slug}`, 'sitemap']));

    expect((await anonClient().from('pages').select('id').eq('id', page!.id)).data).toHaveLength(1);
    const { data: log } = await admin
      .from('activity_logs')
      .select('source, action')
      .eq('entity_id', page!.id)
      .single();
    expect(log).toEqual({ source: 'cron', action: 'pages.publish' });
  });
});

describe('/api/cron/housekeeping', () => {
  it('removes files that no library item points at', async () => {
    expect((await call(housekeeping.GET, '/api/cron/housekeeping', 'wrong')).status).toBe(401);
    const admin = adminClient();
    const path = `${randomUUID()}/${randomUUID()}.png`;
    await admin.storage
      .from('media')
      .upload(path, Buffer.from('not really a png'), { contentType: 'image/png' });
    // Only files older than an hour are touched: backdate this one (storage isn't exposed over REST).
    const db = new Client({
      connectionString:
        process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
    });
    await db.connect();
    await db.query(
      `update storage.objects set created_at = now() - interval '2 hours' where name = $1`,
      [path],
    );
    await db.end();

    const res = await call(housekeeping.GET, '/api/cron/housekeeping');
    expect(res.status).toBe(200);
    expect(
      ((await res.json()) as { orphan_media_objects: number }).orphan_media_objects,
    ).toBeGreaterThanOrEqual(1);
    const { data } = await admin.storage.from('media').list(path.split('/')[0]);
    expect(data).toEqual([]);
  });
});
