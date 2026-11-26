import { adminClient } from '../test/support/supabase';
import { loginAs } from './auth-helpers';
import { openEditor, toast, unique } from './cms-helpers';
import { expect, expectAxeClean, screenshot, test } from './fixtures';

/**
 * Approval workflow on (Q4, P4-A). Runs alone, after every other project (playwright.config.ts),
 * because it switches a site-wide setting.
 */
async function setApproval(on: boolean) {
  const admin = adminClient();
  const { data } = await admin.from('site_settings').select('data').eq('id', 1).single();
  const settings = data?.data as { features: Record<string, boolean> };
  settings.features.contentApproval = on;
  const { error } = await admin
    .from('site_settings')
    .update({ data: settings as never })
    .eq('id', 1);
  if (error) throw error;
}

test.beforeAll(() => setApproval(true));
test.afterAll(() => setApproval(false));

test('editors submit for approval; the headteacher sees it on the dashboard and publishes', async ({
  page,
  browser,
  cspViolations,
}) => {
  test.setTimeout(120_000);
  const title = unique('Exam timetable');
  await loginAs(page, 'content_editor', '/admin/pages');
  await page.getByRole('button', { name: 'New page' }).click();
  await page.getByRole('dialog', { name: 'New page' }).getByLabel('Page title').fill(title);
  await page.getByRole('button', { name: 'Create and edit' }).click();
  await page.waitForURL(/\/admin\/pages\/[0-9a-f-]{36}$/);
  const id = page.url().split('/').pop() ?? '';
  await page.getByRole('textbox', { name: 'Page text' }).click();
  await page.keyboard.type('Papers start on Monday 2 November.');

  await expect(page.getByRole('button', { name: 'Publish to website' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Submit for approval' }).click();
  await expect(toast(page, 'Sent for approval')).toBeVisible();
  await expect(page.getByText('Waiting for someone to approve it.')).toBeVisible();

  const headteacherContext = await browser.newContext();
  const headteacher = await headteacherContext.newPage();
  await loginAs(headteacher, 'headteacher');
  const tile = headteacher.getByRole('link', { name: /pages? waiting for your approval/ });
  await expect(tile).toBeVisible();
  await expectAxeClean(headteacher);
  await screenshot(headteacher, 'cms-dashboard-approval-desktop');
  await tile.click();
  await expect(headteacher.getByRole('button', { name: 'Waiting for approval' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await openEditor(headteacher, id);
  await expect(headteacher.getByRole('button', { name: 'Send back…' })).toBeVisible();
  await headteacher.getByRole('button', { name: 'Publish to website' }).click();
  await expect(toast(headteacher, 'Published to the website')).toBeVisible();
  const { data } = await adminClient().from('pages').select('status').eq('id', id).single();
  expect(data?.status).toBe('published');
  await headteacherContext.close();
  expect(cspViolations).toEqual([]);
});
