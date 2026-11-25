import AxeBuilder from '@axe-core/playwright';
import { test as base, expect, type Page } from '@playwright/test';

export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * Waits for the hero's one-off entrance (the h1 rising, the rest fading up) to finish, so axe
 * measures the final colours rather than text caught mid-fade.
 */
export async function settleEntrance(page: Page) {
  await page.evaluate(async () => {
    const entrance = document
      .getAnimations()
      .filter((a) => ['tpl-rise', 'tpl-fade-up'].includes((a as CSSAnimation).animationName));
    await Promise.all(entrance.map((a) => a.finished.catch(() => undefined)));
  });
}

/** Every page must pass axe with zero violations (MP §10). */
export async function expectAxeClean(page: Page) {
  await settleEntrance(page);
  // The title is streamed metadata. When a Server Action sets a cookie, Next refreshes the route
  // and the <title> is briefly replaced, so wait for it (a page with no title still fails here).
  await expect(page, 'page title').toHaveTitle(/\S/);
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const summary = results.violations.map(
    (v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`,
  );
  expect(summary, 'axe violations').toEqual([]);
}

/** Collects CSP violations reported by the browser; every test asserts none occurred. */
export const test = base.extend<{ cspViolations: string[] }>({
  cspViolations: async ({ page }, use) => {
    const violations: string[] = [];
    page.on('console', (msg) => {
      if (/Content Security Policy|violates the following/.test(msg.text()))
        violations.push(msg.text());
    });
    await use(violations);
    expect(violations, 'CSP violations').toEqual([]);
  },
});

export { expect };

export async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: `test-results/screenshots/${name}.png`, fullPage: true });
}
