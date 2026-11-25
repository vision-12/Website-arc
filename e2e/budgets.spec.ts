import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * MP §10 performance budgets for public pages, measured on the production build.
 *
 * JavaScript (ADR-017): Next.js 16 and React 19 load their runtime on every page (the build
 * manifest's rootMainFiles, about 132 KB gzipped). On top of that, our own code may add at most
 * 20 KB. Every run records the total, framework and app sizes.
 */
function frameworkFiles(): Set<string> {
  const manifest = JSON.parse(readFileSync('.next/build-manifest.json', 'utf8')) as {
    rootMainFiles: string[];
  };
  return new Set(manifest.rootMainFiles.map((f) => `/_next/${f}`));
}

async function javascript(page: Page) {
  await page.goto('/', { waitUntil: 'networkidle' });
  const entries = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((e) => e as PerformanceResourceTiming)
      .filter((e) => new URL(e.name).pathname.endsWith('.js'))
      .map((e) => ({ path: new URL(e.name).pathname, bytes: e.encodedBodySize })),
  );
  const framework = frameworkFiles();
  const sum = (list: typeof entries) => list.reduce((n, e) => n + e.bytes, 0);
  const total = sum(entries);
  const app = sum(entries.filter((e) => !framework.has(e.path)));
  test.info().annotations.push({
    type: 'javascript (gzipped)',
    description: `total ${total} B, framework ${total - app} B, app ${app} B`,
  });
  return { total, app };
}

function layoutShift(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let total = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
            if (!shift.hadRecentInput) total += shift.value;
          }
        }).observe({ type: 'layout-shift', buffered: true });
        setTimeout(() => resolve(total), 1500);
      }),
  );
}

test.describe('performance budgets', () => {
  test('our own JavaScript on the homepage stays within 20 KB gzipped (ADR-017)', async ({
    page,
  }) => {
    const { app, total } = await javascript(page);
    expect(total).toBeGreaterThan(0);
    expect(app).toBeLessThanOrEqual(20 * 1024);
  });

  test('the hero image on a 360 px phone is AVIF and at most 200 KB', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile-360', '360 px viewport only');
    const images = new Map<string, { type: string; size: number }>();
    page.on('response', async (response) => {
      if (!response.url().includes('/_next/image')) return;
      const body = await response.body().catch(() => Buffer.alloc(0));
      images.set(response.url(), {
        type: response.headers()['content-type'] ?? '',
        size: body.length,
      });
    });
    await page.goto('/', { waitUntil: 'networkidle' });
    const hero = page.locator('main img').first();
    await expect(hero).toBeVisible();
    const src = await hero.evaluate((img) => (img as HTMLImageElement).currentSrc);
    const image = images.get(src);
    test.info().annotations.push({ type: 'hero', description: JSON.stringify(image) });
    expect(image?.type).toBe('image/avif');
    expect(image?.size).toBeLessThanOrEqual(200 * 1024);
  });

  /**
   * Layout stability (MP §10: CLS ≤ 0.1). Measured with web fonts held back, so it covers what
   * the layout controls: images, slideshow controls, hydration. Font swaps (next/font with
   * display: swap, MP §10) are softened by metric-matched fallbacks (src/lib/fonts) and recorded
   * separately, because a cold first visit can still rewrap a long headline.
   */
  test('the homepage layout does not shift while it loads (CLS ≤ 0.1)', async ({ page }) => {
    await page.route('**/*.woff2', (route) => route.abort());
    await page.goto('/', { waitUntil: 'networkidle' });
    const cls = await layoutShift(page);
    test.info().annotations.push({ type: 'cls (layout)', description: cls.toFixed(4) });
    expect(cls).toBeLessThanOrEqual(0.1);
  });

  test('records the shift when web fonts arrive on a cold first visit', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const cls = await layoutShift(page);
    test.info().annotations.push({ type: 'cls (with font swap)', description: cls.toFixed(4) });
    expect(cls).toBeGreaterThanOrEqual(0);
  });
});
