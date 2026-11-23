import { expect, expectAxeClean, screenshot, test } from './fixtures';

test.describe('public site shell', () => {
  test('home renders with security headers, theme and no accessibility issues', async ({
    page,
    cspViolations,
  }, info) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);

    const headers = response!.headers();
    expect(headers['content-security-policy']).toMatch(/script-src 'self' 'nonce-/);
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['strict-transport-security']).toContain('max-age=63072000');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['permissions-policy']).toContain('camera=()');
    expect(headers['x-powered-by']).toBeUndefined();

    await expect(page.locator('h1')).toHaveCount(1);
    const brand = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--brand-primary').trim(),
    );
    expect(brand).toMatch(/^#[0-9a-f]{6}$/);

    await expectAxeClean(page);
    await screenshot(page, `public-home-${info.project.name}`);
    expect(cspViolations).toEqual([]);
  });

  test('skip link moves focus to the main content', async ({ page, cspViolations }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();
    expect(cspViolations).toEqual([]);
  });

  test('robots.txt blocks indexing while the site is not launched', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(await res.text()).toMatch(/Disallow: \//);
  });

  test('theme stylesheet is versioned and immutable', async ({ request }) => {
    const res = await request.get('/theme.css?v=0');
    expect(res.headers()['content-type']).toContain('text/css');
    expect(res.headers()['cache-control']).toContain('immutable');
    expect(await res.text()).toContain('--brand-primary:');
  });
});
