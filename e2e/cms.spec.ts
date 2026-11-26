import { adminClient } from '../test/support/supabase';
import { loginAs } from './auth-helpers';
import {
  nextMinuteInKampala,
  openEditor,
  photo,
  runPublishCron,
  seedPage,
  toast,
  unique,
  visitor,
} from './cms-helpers';
import { expect, expectAxeClean, screenshot, test } from './fixtures';

/**
 * Phase 4 Definition of Done (plan §1, §8): an editor creates a page with a photo (description
 * required), sees it autosave, previews the draft, schedules it and watches the job publish it;
 * two people editing the same page get the conflict message instead of overwriting each other.
 */

test.describe('pages: the editor’s journey', () => {
  test('create, add a described photo, autosave, preview, schedule and publish by the job', async ({
    page,
    context,
    browser,
    request,
    cspViolations,
  }, info) => {
    test.skip(info.project.name !== 'desktop', 'one full journey; small screens are covered below');
    test.setTimeout(240_000);
    await loginAs(page, 'content_editor', '/admin/pages');

    // Create
    const title = unique('Science fair');
    await page.getByRole('button', { name: 'New page' }).click();
    await page.getByRole('dialog', { name: 'New page' }).getByLabel('Page title').fill(title);
    await page.getByRole('button', { name: 'Create and edit' }).click();
    await page.waitForURL(/\/admin\/pages\/[0-9a-f-]{36}$/);
    const id = page.url().split('/').pop() ?? '';
    await page.getByRole('textbox', { name: 'Page text' }).waitFor();

    // Autosave: "Saving…", then "All changes saved"; the text survives a reload.
    await page.getByRole('textbox', { name: 'Page text' }).click();
    await page.keyboard.type('Pupils show their projects in the main hall from 9am.');
    await expect(page.getByRole('status').filter({ hasText: 'Saving…' })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'All changes saved' })).toBeVisible({
      timeout: 15_000,
    });
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Page text' })).toContainText(
      'main hall from 9am',
    );
    await expect(page.getByText(/Your changes from .* were kept/)).toBeVisible();

    // A photo can't go in until it has a description (MP §5.9).
    await page.getByRole('textbox', { name: 'Page text' }).click();
    await page.keyboard.press('End');
    await page.getByRole('button', { name: 'Add a photo' }).click();
    const picker = page.getByRole('dialog', { name: 'Choose a photo' });
    await picker.getByLabel('Choose files').setInputFiles({
      name: 'science-fair.jpg',
      mimeType: 'image/jpeg',
      buffer: await photo(),
    });
    const describe = page.getByRole('dialog', { name: 'Describe this photo first' });
    await expect(describe).toBeVisible({ timeout: 30_000 });
    await describe.getByRole('button', { name: 'Save and insert' }).click();
    await expect(describe.getByRole('alert')).toContainText('Add a photo description first');
    await describe
      .getByLabel('Photo description (for blind visitors and Google)')
      .fill('Pupils presenting a model volcano');
    await describe.getByRole('button', { name: 'Save and insert' }).click();
    await expect(
      page.getByRole('img', { name: 'Pupils presenting a model volcano' }),
    ).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'All changes saved' })).toBeVisible({
      timeout: 15_000,
    });
    await expectAxeClean(page);
    await screenshot(page, 'cms-editor-desktop');

    // Save the draft: the address now exists, still not public.
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(toast(page, 'Draft saved')).toBeVisible();
    const { data: saved } = await adminClient().from('pages').select('path').eq('id', id).single();
    const path = saved?.path ?? '';

    // Preview in a new tab: the banner, the photo, noindex; visitors can't see it.
    const [preview] = await Promise.all([
      context.waitForEvent('page'),
      page.getByRole('button', { name: /^Preview/ }).click(),
    ]);
    await preview.waitForURL(`**${path}`);
    await expect(preview.getByText('Preview — not published')).toBeVisible();
    await expect(preview.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(
      preview.getByRole('img', { name: 'Pupils presenting a model volcano' }),
    ).toBeVisible();
    const previewResponse = await preview.reload();
    expect(previewResponse?.headers()['x-robots-tag']).toContain('noindex');
    await screenshot(preview, 'cms-preview-desktop');
    const anon = await visitor(browser);
    await anon.goto(path);
    await expect(anon.getByRole('heading', { name: 'Page not found' })).toBeVisible();

    // Schedule for the next minute (Kampala time); the job publishes it once it's due.
    const when = nextMinuteInKampala();
    await page.bringToFront();
    await page.getByRole('button', { name: 'Schedule…' }).click();
    const schedule = page.getByRole('dialog', { name: 'Schedule publishing' });
    await schedule.getByLabel('Date').fill(when.date);
    await schedule.getByLabel('Time').fill(when.time);
    await schedule.getByRole('button', { name: 'Schedule' }).click();
    await expect(page.getByText(/^Goes live on /)).toBeVisible();
    await expect(page.getByText('Scheduled', { exact: true }).first()).toBeVisible();

    await runPublishCron(request); // too early: nothing for this page
    const { data: early } = await adminClient()
      .from('pages')
      .select('status')
      .eq('id', id)
      .single();
    expect(early?.status).toBe('scheduled');

    await page.waitForTimeout(Math.max(0, when.at.getTime() - Date.now() + 1_500));
    expect((await runPublishCron(request)).published).toBeGreaterThanOrEqual(1);
    const { data: live } = await adminClient().from('pages').select('status').eq('id', id).single();
    expect(live?.status).toBe('published');

    await expect(async () => {
      await anon.goto(path);
      await expect(anon.getByRole('heading', { level: 1, name: title })).toBeVisible({
        timeout: 2_000,
      });
    }).toPass({ timeout: 20_000 });
    await expect(
      anon.getByRole('img', { name: 'Pupils presenting a model volcano' }),
    ).toBeVisible();
    await expect(anon.getByText('Preview — not published')).toHaveCount(0);
    await screenshot(anon, 'cms-published-page-desktop');
    expect(cspViolations).toEqual([]);
  });
});

test.describe('two people editing the same page (MP §5 optimistic concurrency)', () => {
  test('the second publish gets the conflict message; nothing is overwritten', async ({
    browser,
    cspViolations,
  }, info) => {
    test.skip(info.project.name !== 'desktop', 'two browsers side by side');
    test.setTimeout(120_000);
    const seeded = await seedPage({
      title: unique('Open day'),
      slug: unique('open-day'),
      text: 'Open day is on Saturday.',
    });

    const editorContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const adminContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const editor = await editorContext.newPage();
    const admin = await adminContext.newPage();
    await loginAs(editor, 'content_editor');
    await loginAs(admin, 'school_admin');
    await openEditor(editor, seeded.id);
    await openEditor(admin, seeded.id);

    // Both type; each keeps their own unsaved copy.
    await editor.getByRole('textbox', { name: 'Page text' }).click();
    await editor.keyboard.press('End');
    await editor.keyboard.type(' Bring your report card.');
    await expect(editor.getByRole('status').filter({ hasText: 'All changes saved' })).toBeVisible({
      timeout: 15_000,
    });

    await admin.getByRole('textbox', { name: 'Page text' }).click();
    await admin.keyboard.press('End');
    await admin.keyboard.type(' Parking is behind the hall.');
    await expect(admin.getByRole('status').filter({ hasText: 'All changes saved' })).toBeVisible({
      timeout: 15_000,
    });
    // The administrator is told someone else is editing.
    await expect(admin.getByText(/is also editing this page/)).toBeVisible();

    // The administrator publishes first.
    await admin.getByRole('button', { name: 'Publish changes' }).click();
    await expect(toast(admin, 'Changes published to the website')).toBeVisible();

    // The editor's publish is refused with the MP message.
    await editor.getByRole('button', { name: 'Publish changes' }).click();
    const conflict = editor.getByRole('alertdialog');
    await expect(conflict).toContainText('Someone else edited this — reload to see their changes.');
    await expectAxeClean(editor);
    await screenshot(editor, 'cms-conflict-desktop');

    // Visitors see the administrator's version.
    const { data: row } = await adminClient()
      .from('pages')
      .select('body')
      .eq('id', seeded.id)
      .single();
    expect(JSON.stringify(row?.body)).toContain('Parking is behind the hall.');
    expect(JSON.stringify(row?.body)).not.toContain('Bring your report card.');

    // After reloading, the editor's text is offered back, never lost.
    await conflict.getByRole('button', { name: 'Reload the page' }).click();
    await expect(editor.getByText(/made before someone else changed this page/)).toBeVisible();
    await expect(editor.getByRole('textbox', { name: 'Page text' })).toContainText(
      'Parking is behind the hall.',
    );
    await editor.getByRole('button', { name: 'Show my changes' }).click();
    await expect(editor.getByRole('textbox', { name: 'Page text' })).toContainText(
      'Bring your report card.',
    );

    await editorContext.close();
    await adminContext.close();
    expect(cspViolations).toEqual([]);
  });
});

test.describe('Trash, addresses and media', () => {
  test('trash and restore a page; visitors lose it and get it back', async ({
    page,
    browser,
    cspViolations,
  }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop journey');
    const title = unique('Uniform list');
    const seeded = await seedPage({ title, slug: unique('uniform-list') });
    await loginAs(page, 'content_editor');
    await openEditor(page, seeded.id);
    await page.getByRole('button', { name: 'Move to Trash' }).click();
    const confirm = page.getByRole('dialog', { name: `Move ‘${title}’ to Trash?` });
    await expect(confirm).toContainText('This can be undone from Trash for 30 days.');
    await confirm.getByRole('button', { name: 'Move to Trash' }).click();
    await page.waitForURL('**/admin/pages');

    const anon = await visitor(browser);
    await expect(async () => {
      await anon.goto(seeded.path);
      await expect(anon.getByRole('heading', { name: 'Page not found' })).toBeVisible({
        timeout: 2_000,
      });
    }).toPass({ timeout: 15_000 });

    await page
      .getByRole('navigation', { name: 'Administration sections' })
      .getByRole('link', { name: 'Trash' })
      .click();
    await page.waitForURL('**/admin/trash');
    const row = page
      .getByRole('list', { name: 'Items in Trash' })
      .getByRole('listitem')
      .filter({ hasText: title });
    await expect(row).toContainText('Kept until');
    await expectAxeClean(page);
    await screenshot(page, 'cms-trash-desktop');
    await row.getByRole('button', { name: /^Restore/ }).click();
    await expect(toast(page, `Restored ‘${title}’`)).toBeVisible();

    await expect(async () => {
      await anon.goto(seeded.path);
      await expect(anon.getByRole('heading', { level: 1, name: title })).toBeVisible({
        timeout: 2_000,
      });
    }).toPass({ timeout: 15_000 });
    expect(cspViolations).toEqual([]);
  });

  test('changing a live page’s address leaves a 308 from the old one', async ({
    page,
    browser,
    request,
    cspViolations,
  }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop journey');
    test.setTimeout(120_000);
    const oldSlug = unique('term-dates');
    const newSlug = unique('school-terms');
    const seeded = await seedPage({ title: 'Term dates', slug: oldSlug });
    const anon = await visitor(browser);
    await anon.goto(`/${oldSlug}`);
    await expect(anon.getByRole('heading', { level: 1, name: 'Term dates' })).toBeVisible();

    await loginAs(page, 'content_editor');
    await openEditor(page, seeded.id);
    await page.getByLabel('Web address').fill(newSlug);
    await page.getByRole('button', { name: 'Publish changes' }).click();
    await expect(toast(page, 'Changes published to the website')).toBeVisible();

    // proxy.ts answers from a copy of the redirects table refreshed every 30 seconds (plan P4-H).
    await expect
      .poll(
        async () => {
          const res = await request.get(`/${oldSlug}`, { maxRedirects: 0 });
          return `${res.status()} ${new URL(res.headers().location ?? '/', 'http://x').pathname}`;
        },
        { timeout: 75_000, intervals: [2_000] },
      )
      .toBe(`308 /${newSlug}`);
    expect(cspViolations).toEqual([]);
  });

  test('a photo used on a page cannot be trashed; the library offers Replace', async ({
    page,
    cspViolations,
  }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop journey');
    // A described demo photo, placed on a page (the database records the usage).
    const photoId = '0d3e0000-0000-4000-8000-000000000004';
    const pageTitle = unique('Maths week');
    await seedPage({
      title: pageTitle,
      slug: unique('maths-week'),
      body: {
        type: 'doc',
        content: [{ type: 'image', attrs: { mediaId: photoId, size: 'normal' } }],
      },
    });
    await loginAs(page, 'content_editor', '/admin/media');
    await page.getByLabel('Search the library').fill('intro');
    await page
      .getByRole('button', { name: /intro\.webp/ })
      .first()
      .click();
    const details = page.getByRole('dialog', { name: 'intro.webp' });
    await expect(details.getByRole('heading', { name: 'Used in' })).toBeVisible();
    await expect(details.getByRole('link', { name: pageTitle })).toBeVisible();
    await expect(details).toContainText('so it can’t be moved to Trash');
    await expect(details.getByText(/Replace with another photo/)).toBeVisible();
    await expect(details.getByRole('button', { name: 'Move to Trash' })).toHaveCount(0);
    expect(cspViolations).toEqual([]);
  });
});

test.describe('who sees what (PRD §6.2)', () => {
  test('read-only staff can look at pages but not change them, and see no Trash', async ({
    page,
    cspViolations,
  }) => {
    const seeded = await seedPage({ title: unique('Clubs'), slug: unique('clubs') });
    await loginAs(page, 'read_only_staff');
    await openEditor(page, seeded.id);
    await expect(page.getByText('You can look at this page, but not change it.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Publish/ })).toHaveCount(0);
    await expect(page.getByLabel('Page title')).toBeDisabled();
    await expect(page.getByRole('link', { name: 'Trash' })).toHaveCount(0);
    expect(cspViolations).toEqual([]);
  });

  test('the dashboard shows the content editor what needs doing, each tile a link', async ({
    page,
    cspViolations,
  }, info) => {
    await loginAs(page, 'content_editor');
    await expect(page.getByRole('list', { name: 'Things to do' })).toBeVisible();
    await expect(page.getByRole('link', { name: /photos? needs? a description/ })).toHaveAttribute(
      'href',
      '/admin/media?filter=missing-description',
    );
    await expectAxeClean(page);
    await screenshot(page, `cms-dashboard-${info.project.name}`);
    expect(cspViolations).toEqual([]);
  });
});

test.describe('screens on every screen size (axe, 360 px and 1280 px)', () => {
  test('pages list, editor and media library', async ({ page, cspViolations }, info) => {
    const seeded = await seedPage({
      title: unique('Library hours'),
      slug: unique('library-hours'),
      text: 'Open 8am to 5pm.',
    });
    await loginAs(page, 'content_editor', '/admin/pages');
    await expect(page.getByRole('list', { name: 'Pages' })).toBeVisible();
    await expectAxeClean(page);
    await screenshot(page, `cms-pages-${info.project.name}`);

    await openEditor(page, seeded.id);
    await expectAxeClean(page);
    await screenshot(page, `cms-editor-${info.project.name}`);

    await page.goto('/admin/media');
    await page.getByRole('heading', { level: 1, name: 'Media library' }).waitFor();
    await expectAxeClean(page);
    await screenshot(page, `cms-media-${info.project.name}`);
    expect(cspViolations).toEqual([]);
  });

  test('a published CMS page in the school’s template', async ({ page, cspViolations }, info) => {
    await page.goto('/about');
    await expect(page.getByRole('heading', { level: 1, name: 'About the school' })).toBeVisible();
    await expectAxeClean(page);
    await screenshot(page, `cms-public-page-${info.project.name}`);
    expect(cspViolations).toEqual([]);
  });
});
