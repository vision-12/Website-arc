import type { Page } from '@playwright/test';
import { SiteSettings } from '../src/features/cms/settings/schema';
import { signPreviewToken } from '../src/features/appearance/preview-token';
import { adminClient, createStaffUser } from '../test/support/supabase';
import { loginAs, signIn } from './auth-helpers';
import { expect, expectAxeClean, screenshot, test } from './fixtures';

const TEMPLATES = [
  'institutional-classic',
  'modern-academic',
  'heritage-prestige',
  'contemporary-community',
] as const;
const LABELS: Record<(typeof TEMPLATES)[number], string> = {
  'institutional-classic': 'Institutional Classic',
  'modern-academic': 'Modern Academic',
  'heritage-prestige': 'Heritage & Prestige',
  'contemporary-community': 'Contemporary Community',
};
/** Sections whose modules arrive in later phases: their loaders show nothing yet. */
const AWAITING_MODULE = new Set([
  'academicOverview',
  'latestNews',
  'leadershipMessage',
  'upcomingEvents',
  'galleryPreview',
]);

function secret(): string {
  const value = process.env.PREVIEW_TOKEN_SECRET;
  if (!value) throw new Error('PREVIEW_TOKEN_SECRET is not set');
  return value;
}

async function savedSettings() {
  const { data, error } = await adminClient()
    .from('site_settings')
    .select('data')
    .eq('id', 1)
    .single();
  if (error) throw error;
  return SiteSettings.parse(data.data);
}

/** The headings the homepage should show, in the school's order. */
async function expectedHeadings(): Promise<string[]> {
  const settings = await savedSettings();
  return settings.homepage.flatMap((section) => {
    const heading = (section.settings as { heading?: unknown }).heading;
    return section.visible && typeof heading === 'string' && !AWAITING_MODULE.has(section.type)
      ? [heading]
      : [];
  });
}

const sectionHeadings = async (page: Page) =>
  (await page.locator('main h2').allInnerTexts()).map((h) => h.trim());

test.describe('homepage in the school’s template', () => {
  test('shows the school’s sections in its order with one h1', async ({ page, cspViolations }) => {
    await page.goto('/');
    const settings = await savedSettings();
    await expect(page.locator(`[data-template="${settings.theme.template}"]`)).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveText(settings.identity.name);
    expect(await sectionHeadings(page)).toEqual(await expectedHeadings());
    expect(cspViolations).toEqual([]);
  });

  test('desktop menus open from their word and close with Escape', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop navigation');
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Main' });
    const about = nav.locator('details > summary', { hasText: 'About' });
    await about.click();
    const submenu = nav.getByRole('list', { name: 'About pages' });
    await expect(submenu).toBeVisible();
    await expect(submenu.getByRole('link', { name: 'History' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(submenu).toBeHidden();
    await expect(about).toBeFocused();
  });

  test('the phone menu works by keyboard and returns focus', async ({ page }, info) => {
    test.skip(info.project.name === 'desktop', 'phone menu');
    await page.goto('/');
    const button = page.locator('details[data-tpl-menu="mobile"] > summary');
    await button.focus();
    await page.keyboard.press('Enter');
    const panel = page.locator('details[data-tpl-menu="mobile"][open]');
    await expect(panel).toHaveCount(1);
    await expect(panel.getByRole('link', { name: 'Apply' })).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(panel.locator(':focus')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(button).toBeFocused();
  });

  test('the slideshow can be paused, and stays still under reduced motion', async ({ page }) => {
    await page.goto('/');
    const pause = page.getByRole('button', { name: 'Pause slideshow' });
    await pause.click();
    await expect(page.getByRole('button', { name: 'Play slideshow' })).toBeVisible();

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Next slide' })).toBeVisible();
    await expect(page.getByRole('button', { name: /slideshow/ })).toHaveCount(0);
  });
});

test.describe('template preview (spec §6.4)', () => {
  test('signed-out visitors are sent to sign in', async ({ page }) => {
    await page.goto('/preview/template/modern-academic?t=abc');
    await expect(page).toHaveURL(/\/login\?next=%2Fpreview%2Ftemplate%2Fmodern-academic/);
  });

  test('people without appearance access see a plain message', async ({ page }) => {
    const user = await createStaffUser(null);
    const token = signPreviewToken({ userId: user.id, template: 'heritage-prestige' }, secret());
    await signIn(page, user, `/preview/template/heritage-prestige?t=${token}`);
    await expect(
      page.getByRole('heading', { name: 'You can’t preview the website’s appearance' }),
    ).toBeVisible();
  });

  test('bad, expired and someone else’s links show a message', async ({ page }) => {
    const user = await loginAs(page, 'school_admin');
    const stranger = await createStaffUser('school_admin');
    const cases = [
      ['nonsense', 'This preview link does not work'],
      [
        signPreviewToken(
          { userId: user.id, template: 'modern-academic' },
          secret(),
          Date.now() - 11 * 60_000,
        ),
        'This preview link has expired',
      ],
      [
        signPreviewToken({ userId: stranger.id, template: 'modern-academic' }, secret()),
        'This preview link does not work',
      ],
      [
        signPreviewToken({ userId: user.id, template: 'heritage-prestige' }, secret()),
        'This preview link does not work',
      ],
    ] as const;
    for (const [token, message] of cases) {
      await page.goto(`/preview/template/modern-academic?t=${encodeURIComponent(token)}`);
      await expect(page.getByRole('heading', { name: message })).toBeVisible();
    }
  });

  test('every template shows every homepage section, privately and only framed by this site', async ({
    page,
    cspViolations,
  }, info) => {
    test.setTimeout(120_000);
    const user = await loginAs(page, 'school_admin');
    const headings = await expectedHeadings();
    expect(headings.length).toBeGreaterThanOrEqual(4);

    for (const key of TEMPLATES) {
      const token = signPreviewToken({ userId: user.id, template: key }, secret());
      const response = await page.goto(`/preview/template/${key}?t=${token}`);
      const headers = response!.headers();
      expect(headers['content-security-policy']).toContain("frame-ancestors 'self'");
      expect(headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(headers['cache-control']).toContain('no-store');
      expect(headers['x-robots-tag']).toContain('noindex');
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

      await expect(page.locator(`[data-template="${key}"]`)).toBeVisible();
      await expect(
        page.getByText(`Preview of ${LABELS[key]}. Nothing here is saved.`),
      ).toBeVisible();
      await expect(page.locator('h1')).toHaveCount(1);
      expect(await sectionHeadings(page), key).toEqual(headings);
      await expectAxeClean(page);
      await screenshot(page, `preview-${key}-${info.project.name}`);
    }
    expect(cspViolations).toEqual([]);
  });

  test('the rest of the site still refuses to be framed', async ({ page }) => {
    const response = await page.goto('/');
    expect(response!.headers()['x-frame-options']).toBe('DENY');
    expect(response!.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  });
});

test.describe('demo gallery (plan P3-C)', () => {
  const DEMO_HEADINGS = [
    'About the school',
    'Academics',
    'News from the school',
    'The school in numbers',
    'A message from the head teacher',
    'Coming up',
    'School life',
    'Parents and former students',
    'Getting here',
    'Admissions for 2027',
  ];

  for (const key of TEMPLATES) {
    test(`${key}: every section, accessible and CSP-clean`, async ({
      page,
      cspViolations,
    }, info) => {
      await page.goto(`/preview/demo/${key}`);
      await expect(page.locator(`[data-template="${key}"]`)).toBeVisible();
      await expect(page.locator('h1')).toHaveCount(1);
      expect((await sectionHeadings(page)).sort()).toEqual([...DEMO_HEADINGS].sort());
      await expectAxeClean(page);
      await screenshot(page, `demo-${key}-${info.project.name}`);
      expect(cspViolations).toEqual([]);
    });

    test(`${key}: inner pages in all three layouts`, async ({ page, cspViolations }, info) => {
      test.skip(info.project.name === 'android', 'layouts are covered at 1280 and 360');
      for (const layout of ['default', 'wide', 'with-sidebar']) {
        await page.goto(`/preview/demo/${key}/page/${layout}`);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('About the school');
        await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible();
        if (layout === 'with-sidebar')
          await expect(page.getByRole('navigation', { name: 'In this section' })).toBeVisible();
        await expectAxeClean(page);
        await screenshot(page, `demo-${key}-page-${layout}-${info.project.name}`);
      }
      expect(cspViolations).toEqual([]);
    });
  }
});
