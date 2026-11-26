import sharp from 'sharp';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminClient } from '../../../../test/support/supabase';
import { actAs, expiredTags, putToSignedUrl, signInAs } from '../../../../test/support/actions';

vi.mock('@/lib/supabase/server', async (orig) =>
  (await import('../../../../test/support/actions')).serverMock(orig),
);
vi.mock('next/cache', async () => (await import('../../../../test/support/actions')).cacheMock());

const media = await import('../actions');
const pages = await import('@/features/pages/actions');

const photoWithExif = () =>
  sharp({
    create: { width: 3200, height: 1800, channels: 3, background: { r: 10, g: 140, b: 90 } },
  })
    .jpeg()
    .withExif({ IFD0: { Copyright: 'GPS 0.3476 N, 32.5825 E' } })
    .toBuffer();

async function upload(
  bytes: Uint8Array,
  filename: string,
  mime: 'image/jpeg' | 'image/png' | 'application/pdf',
) {
  const req = await media.requestMediaUpload({ filename, mime, size: bytes.length });
  if (!req.ok) throw new Error(req.error.message);
  await putToSignedUrl(req.data.signedUrl, bytes, mime);
  return media.confirmMediaUpload({ assetId: req.data.assetId });
}

beforeEach(() => {
  expiredTags.length = 0;
  actAs(null);
});

describe('media library actions (spec §4.2, ADR-018)', () => {
  it('uploads straight to storage, then the server shrinks the photo and strips its metadata', async () => {
    await signInAs('content_editor');
    const r = await upload(await photoWithExif(), 'sports-day.jpg', 'image/jpeg');
    if (!r.ok) throw new Error(r.error.message);
    expect(r.data).toMatchObject({
      kind: 'image',
      width: 2560,
      height: 1440,
      filename: 'sports-day.jpg',
    });
    expect(r.data.lqip).toMatch(/^data:image\/webp;base64,/);

    const stored = await fetch(r.data.url);
    expect(stored.ok).toBe(true);
    const meta = await sharp(Buffer.from(await stored.arrayBuffer())).metadata();
    expect(meta.exif).toBeUndefined();

    const { data: objects } = await adminClient().storage.from('media').list(r.data.id);
    expect(objects?.map((o) => o.name)).toHaveLength(1); // the original upload was replaced
    const { data: log } = await adminClient()
      .from('activity_logs')
      .select('action')
      .eq('entity_id', r.data.id);
    expect(log?.map((l) => l.action)).toEqual(['media.upload']);
  });

  it('refuses a program disguised as a photo, in plain words, and removes it', async () => {
    await signInAs('content_editor');
    const exe = Buffer.concat([Buffer.from('MZ\x90\x00', 'latin1'), Buffer.alloc(2048)]);
    const r = await upload(exe, 'holiday.png', 'image/png');
    expect(r).toMatchObject({ ok: false, error: { code: 'UPLOAD_REJECTED' } });
    if (r.ok) return;
    expect(r.error.message).toMatch(/isn’t really/);
  });

  it('enforces permissions: read-only staff cannot upload; visitors cannot see unchecked uploads', async () => {
    await signInAs('read_only_staff');
    const r = await media.requestMediaUpload({ filename: 'x.jpg', mime: 'image/jpeg', size: 100 });
    expect(r).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    actAs(null);
    expect(
      await media.requestMediaUpload({ filename: 'x.jpg', mime: 'image/jpeg', size: 100 }),
    ).toMatchObject({
      ok: false,
      error: { code: 'UNAUTHENTICATED' },
    });
  });

  it('requires a description before a photo goes on a page; an in-use photo cannot be trashed', async () => {
    await signInAs('content_editor');
    const up = await upload(await photoWithExif(), 'library.jpg', 'image/jpeg');
    if (!up.ok) throw new Error(up.error.message);
    const created = await pages.createPage({ title: 'Our library', parentId: null });
    if (!created.ok) throw new Error(created.error.message);
    const values = {
      title: 'Our library',
      slug: `our-library-${Date.now()}`,
      parentId: null,
      body: {
        type: 'doc' as const,
        content: [{ type: 'image', attrs: { mediaId: up.data.id, size: 'normal' } }],
      },
      excerpt: '',
      layout: 'default' as const,
      showInNav: false,
      coverMediaId: null,
      seo: {},
    };
    const refused = await pages.savePage({ id: created.data.id, version: 1, values });
    expect(refused).toMatchObject({ ok: false, error: { code: 'ALT_TEXT_REQUIRED' } });

    const described = await media.updateMedia({
      id: up.data.id,
      version: up.data.version,
      altText: 'Pupils reading in the new library',
      caption: '',
    });
    if (!described.ok) throw new Error(described.error.message);
    expect(expiredTags).toContain(`media:${up.data.id}`);
    const saved = await pages.savePage({ id: created.data.id, version: 1, values });
    expect(saved).toMatchObject({ ok: true });

    const trashed = await media.trashMedia({ id: up.data.id, version: described.data.version });
    expect(trashed).toMatchObject({ ok: false, error: { code: 'MEDIA_IN_USE' } });
    const usages = await media.mediaUsages({ id: up.data.id });
    expect(usages).toMatchObject({
      ok: true,
      data: [{ label: 'Our library', where: 'in the page text' }],
    });
  });

  it('replaces a photo in place: same id, new file, old file removed', async () => {
    await signInAs('content_editor');
    const up = await upload(await photoWithExif(), 'old.jpg', 'image/jpeg');
    if (!up.ok) throw new Error(up.error.message);
    const next = await sharp({
      create: { width: 800, height: 600, channels: 3, background: '#fff' },
    })
      .png()
      .toBuffer();
    const req = await media.requestMediaReplace({
      id: up.data.id,
      filename: 'new.png',
      mime: 'image/png',
      size: next.length,
    });
    if (!req.ok) throw new Error(req.error.message);
    await putToSignedUrl(req.data.signedUrl, next, 'image/png');
    const r = await media.confirmMediaReplace({
      id: up.data.id,
      version: up.data.version,
      path: req.data.path,
      filename: 'new.png',
    });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.data).toMatchObject({
      id: up.data.id,
      filename: 'new.png',
      width: 800,
      height: 600,
      mimeType: 'image/png',
    });
    expect((await fetch(up.data.url)).status).toBeGreaterThanOrEqual(400);
    expect((await fetch(r.data.url)).ok).toBe(true);
  });

  it('keeps a plain PDF and refuses one with scripts', async () => {
    await signInAs('content_editor');
    const pdf = Buffer.from(
      '%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n',
      'latin1',
    );
    const ok = await upload(pdf, 'fees-2027.pdf', 'application/pdf');
    expect(ok).toMatchObject({ ok: true, data: { kind: 'document', filename: 'fees-2027.pdf' } });
    const bad = Buffer.concat([pdf, Buffer.from('<< /S /JavaScript /JS (x) >>', 'latin1')]);
    expect(await upload(bad, 'form.pdf', 'application/pdf')).toMatchObject({
      ok: false,
      error: { code: 'UPLOAD_REJECTED' },
    });
  });
});
