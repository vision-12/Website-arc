import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MESSAGES } from '@/lib/actions/errors';
import { adminClient, anonClient } from '../../../../test/support/supabase';
import { actAs, expiredTags, signInAs } from '../../../../test/support/actions';

vi.mock('@/lib/supabase/server', async (orig) =>
  (await import('../../../../test/support/actions')).serverMock(orig),
);
vi.mock('next/cache', async () => (await import('../../../../test/support/actions')).cacheMock());

const pages = await import('../actions');

const doc = (text: string) => ({
  type: 'doc' as const,
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});
const values = (title: string, slug: string, text = 'Hello') => ({
  title,
  slug,
  parentId: null,
  body: doc(text),
  excerpt: '',
  layout: 'default' as const,
  showInNav: false,
  coverMediaId: null,
  seo: {},
});
const unique = (s: string) => `${s}-${Math.random().toString(36).slice(2, 8)}`;

async function newPage(title: string) {
  const r = await pages.createPage({ title, parentId: null });
  if (!r.ok) throw new Error(r.error.message);
  return r.data.id;
}

async function setApproval(on: boolean) {
  const admin = adminClient();
  const { data } = await admin.from('site_settings').select('data').eq('id', 1).single();
  const settings = data!.data as { features: Record<string, boolean> };
  settings.features.contentApproval = on;
  await admin.from('site_settings').update({ data: settings }).eq('id', 1);
}

beforeEach(() => {
  expiredTags.length = 0;
  actAs(null);
});
afterAll(() => setApproval(false));

describe('pages: create, autosave, save, publish (spec §4.1)', () => {
  it('autosaves to a working copy, then publishes; audited and the public cache expires', async () => {
    await signInAs('content_editor');
    const id = await newPage('Uniform guide');
    const slug = unique('uniform-guide');

    const auto = await pages.autosavePage({ id, baseVersion: 1, data: { title: 'Uniform gu' } });
    expect(auto).toMatchObject({ ok: true, data: { version: 1, stale: false } });
    if (!auto.ok) return;
    expect(auto.data.savedAt).not.toBeNull();
    const { data: live } = await adminClient().from('pages').select('title').eq('id', id).single();
    expect(live?.title).toBe('Uniform guide'); // autosave never touches the page itself (D4)

    const published = await pages.publishPage({
      id,
      version: 1,
      values: values('Uniform guide', slug),
    });
    expect(published).toMatchObject({ ok: true, data: { status: 'published', version: 2 } });
    expect(expiredTags).toEqual(expect.arrayContaining(['pages', `page:/${slug}`, 'sitemap']));

    const { data: copies } = await adminClient()
      .from('content_drafts')
      .select('entity_id')
      .eq('entity_id', id);
    expect(copies).toEqual([]); // publishing applied and removed the working copy
    const { data: log } = await adminClient()
      .from('activity_logs')
      .select('action')
      .eq('entity_id', id)
      .order('id');
    expect(log?.map((l) => l.action)).toEqual(['pages.create', 'pages.publish']);
  });

  it('validates on the server with the same schema as the editor', async () => {
    await signInAs('content_editor');
    const id = await newPage('Fees');
    const r = await pages.savePage({ id, version: 1, values: { ...values('F', 'Bad Slug!') } });
    expect(r).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    if (r.ok) return;
    expect(Object.keys(r.error.fieldErrors ?? {})).toEqual(
      expect.arrayContaining(['values.title', 'values.slug']),
    );
  });

  it('read-only staff and signed-out visitors are refused', async () => {
    await signInAs('content_editor');
    const id = await newPage('Term dates');
    await signInAs('read_only_staff');
    expect(
      await pages.savePage({ id, version: 1, values: values('Term dates', unique('t')) }),
    ).toMatchObject({
      ok: false,
      error: { code: 'FORBIDDEN' },
    });
    actAs(null);
    expect(await pages.createPage({ title: 'Nope', parentId: null })).toMatchObject({
      ok: false,
      error: { code: 'UNAUTHENTICATED' },
    });
  });
});

describe('two people editing the same page (MP §5 optimistic concurrency, P4-D)', () => {
  it('the second save gets the conflict message, and their text is kept', async () => {
    const editor = await signInAs('content_editor');
    const id = await newPage('Open day');
    const slug = unique('open-day');
    await pages.publishPage({ id, version: 1, values: values('Open day', slug, 'Original') });

    // Both open version 2 and type; each keeps their own working copy.
    await pages.autosavePage({ id, baseVersion: 2, data: { title: 'Open day (editor)' } });
    await signInAs('school_admin');
    const adminAuto = await pages.autosavePage({
      id,
      baseVersion: 2,
      data: { title: 'Open day (admin)' },
    });
    expect(adminAuto).toMatchObject({
      ok: true,
      data: { editors: [{ name: expect.any(String) }] },
    });

    // The administrator publishes first.
    const first = await pages.publishPage({
      id,
      version: 2,
      values: values('Open day', slug, 'Admin text'),
    });
    expect(first).toMatchObject({ ok: true, data: { version: 3 } });

    // The editor's publish is refused with the MP message instead of overwriting.
    actAs(editor.client);
    const second = await pages.publishPage({
      id,
      version: 2,
      values: values('Open day', slug, 'Editor text'),
    });
    expect(second).toEqual({ ok: false, error: { code: 'CONFLICT', message: MESSAGES.CONFLICT } });
    expect(MESSAGES.CONFLICT).toBe('Someone else edited this — reload to see their changes.');

    const { data: row } = await adminClient()
      .from('pages')
      .select('body, version')
      .eq('id', id)
      .single();
    expect(JSON.stringify(row?.body)).toContain('Admin text');
    const { data: kept } = await adminClient()
      .from('content_drafts')
      .select('base_version, data')
      .eq('entity_id', id)
      .eq('updated_by', editor.user.id)
      .single();
    expect(kept?.base_version).toBe(2); // stale copy: offered back after reload
    expect(JSON.stringify(kept?.data)).toContain('Editor text');
  });

  it('autosave reports when someone else has published since you started', async () => {
    await signInAs('content_editor');
    const id = await newPage('Transport');
    await pages.publishPage({ id, version: 1, values: values('Transport', unique('transport')) });
    const r = await pages.autosavePage({ id, baseVersion: 1, data: { title: 'Transport x' } });
    expect(r).toMatchObject({ ok: true, data: { stale: true, version: 2 } });
  });
});

describe('approval workflow on (Q4, P4-A)', () => {
  it('editors submit; publishing needs approve; a sent-back note reaches the author', async () => {
    await setApproval(true);
    const editor = await signInAs('content_editor');
    const id = await newPage('Exam timetable');
    const slug = unique('exam-timetable');
    expect(
      await pages.publishPage({ id, version: 1, values: values('Exam timetable', slug) }),
    ).toMatchObject({
      ok: false,
      error: { code: 'FORBIDDEN' },
    });
    const submitted = await pages.submitPageForReview({
      id,
      version: 1,
      values: values('Exam timetable', slug),
    });
    expect(submitted).toMatchObject({ ok: true, data: { status: 'in_review' } });

    await signInAs('headteacher');
    const back = await pages.sendPageBack({
      id,
      version: 2,
      note: 'Please add the Friday papers.',
    });
    expect(back).toMatchObject({ ok: true, data: { status: 'draft' } });

    const { data: note } = await editor.client.rpc('latest_review_note', {
      p_entity_type: 'pages',
      p_entity_id: id,
    });
    expect(note?.[0]?.note).toBe('Please add the Friday papers.');
    await setApproval(false);
  });
});

describe('Trash (MP §11)', () => {
  it('a page with sub-pages cannot be trashed: the reason is in plain words', async () => {
    await signInAs('content_editor');
    const parent = await newPage('Boarding');
    const child = await pages.createPage({ title: 'Boarding fees', parentId: parent });
    expect(child.ok).toBe(true);
    const r = await pages.trashPage({ id: parent, version: 1 });
    expect(r).toEqual({
      ok: false,
      error: {
        code: 'VALIDATION',
        message: 'This page has sub-pages. Move them, or move them to Trash, first.',
      },
    });

    const trashed = await pages.trashPage({ id: child.ok ? child.data.id : '', version: 1 });
    expect(trashed).toMatchObject({ ok: true });
    const restored = await pages.restorePage({ id: child.ok ? child.data.id : '' });
    expect(restored).toMatchObject({ ok: true, data: { renamed: false } });
  });

  it('only trash.purge deletes permanently, after typing the title', async () => {
    await signInAs('content_editor');
    const id = await newPage('Old notice');
    await pages.trashPage({ id, version: 1 });
    expect(await pages.purgePage({ id, confirmTitle: 'Old notice' })).toMatchObject({
      ok: false,
      error: { code: 'FORBIDDEN' },
    });
    // trash.purge is not a personal-data permission, so no MFA step is needed for this check.
    await signInAs('super_admin');
    expect(await pages.purgePage({ id, confirmTitle: 'Wrong' })).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION' },
    });
    expect(await pages.purgePage({ id, confirmTitle: ' old NOTICE ' })).toMatchObject({ ok: true });
  });
});

describe('scheduling', () => {
  it('refuses a time in the past and schedules a future one', async () => {
    await signInAs('content_editor');
    const id = await newPage('Prize giving');
    const slug = unique('prize-giving');
    const past = await pages.schedulePage({
      id,
      version: 1,
      values: values('Prize giving', slug),
      publishAt: new Date(Date.now() - 60_000).toISOString(),
    });
    expect(past).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION', message: 'Choose a time in the future.' },
    });
    const at = new Date(Date.now() + 3_600_000).toISOString();
    const future = await pages.schedulePage({
      id,
      version: 1,
      values: values('Prize giving', slug),
      publishAt: at,
    });
    expect(future).toMatchObject({ ok: true, data: { status: 'scheduled' } });
    const { data: visible } = await anonClient().from('pages').select('id').eq('id', id);
    expect(visible).toEqual([]); // visitors can't see it until the job publishes it
  });
});
