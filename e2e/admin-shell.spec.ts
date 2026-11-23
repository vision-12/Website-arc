import { expect, expectAxeClean, screenshot, test } from './fixtures';

const SECTIONS = [
  'Overview',
  'Website pages',
  'News & announcements',
  'Admissions',
  'Academic programmes',
  'Events calendar',
  'Gallery',
  'Staff directory',
  'Resource centre',
  'Contact enquiries',
  'Media library',
  'Website appearance',
  'Users & permissions',
  'Settings',
  'Activity log',
];

test.describe('admin shell', () => {
  test('is private, noindexed and redirects /admin to the overview', async ({
    page,
    cspViolations,
  }) => {
    const response = await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/overview$/);
    expect(response?.headers()['cache-control']).toBe('private, no-store');
    expect(response?.headers()['x-robots-tag']).toContain('noindex');
    await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
    expect(cspViolations).toEqual([]);
  });

  test('desktop sidebar lists all 15 sections and marks the current one', async ({
    page,
    cspViolations,
  }, info) => {
    test.skip(info.project.name !== 'desktop', 'sidebar is a drawer on small screens');
    await page.goto('/admin/overview');
    const nav = page.getByRole('navigation', { name: 'Administration sections' });
    await expect(nav.getByRole('link')).toHaveText(SECTIONS);
    await expect(nav.getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await nav.getByRole('link', { name: 'News & announcements' }).click();
    await expect(page).toHaveURL(/\/admin\/news$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'News & announcements' }),
    ).toBeVisible();
    await expect(page.getByText('This section is not available yet')).toBeVisible();

    await expectAxeClean(page);
    await page.goto('/admin/overview');
    await expectAxeClean(page);
    await screenshot(page, `admin-overview-${info.project.name}`);
    expect(cspViolations).toEqual([]);
  });

  test('sidebar navigation works with the keyboard and focus is visible', async ({
    page,
    cspViolations,
  }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop sidebar');
    await page.goto('/admin/overview');
    await page.keyboard.press('Tab'); // skip link
    await page.keyboard.press('Tab'); // first sidebar link
    const focused = page.locator(':focus');
    await expect(focused).toHaveText('Overview');
    const outline = await focused.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).toBe('solid');
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toHaveText('Website pages');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/admin\/pages$/);
    expect(cspViolations).toEqual([]);
  });

  test('small screens use an accessible drawer', async ({ page, cspViolations }, info) => {
    test.skip(info.project.name === 'desktop', 'drawer only below 1024px');
    await page.goto('/admin/overview');
    await expect(page.getByRole('navigation', { name: 'Administration sections' })).toHaveCount(0);
    await screenshot(page, `admin-overview-${info.project.name}`);

    await page.getByRole('button', { name: 'Open menu' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('link')).toHaveText(SECTIONS);
    await expectAxeClean(page);
    await screenshot(page, `admin-drawer-${info.project.name}`);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: 'Open menu' })).toBeFocused();

    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('dialog').getByRole('link', { name: 'Events calendar' }).click();
    await expect(page).toHaveURL(/\/admin\/events$/);
    await expect(page.getByRole('dialog')).toBeHidden();
    await expectAxeClean(page);
    expect(cspViolations).toEqual([]);
  });

  test('unknown sections return the not-found page', async ({ page }) => {
    const response = await page.goto('/admin/not-a-section');
    expect(response?.status()).toBe(404);
  });

  test('has no horizontal scrolling at 360px', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile-360', '360px check');
    for (const path of ['/', '/admin/overview']) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
});
