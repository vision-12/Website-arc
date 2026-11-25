import { mkdirSync, writeFileSync } from 'node:fs';
import { devices } from '@playwright/test';
import { expect, test } from './fixtures';

interface Frame {
  start: number;
  duration: number;
  blocking: number;
  /** Time spent rendering (style, layout, paint) at the end of the frame. */
  render: number;
  scripts: string[];
}
interface Perf {
  lcp: number;
  cls: number;
  frames: Frame[];
}

declare global {
  interface Window {
    __perf: Perf;
  }
}

const RUNS = 3;

/**
 * Smoothness on a mid-range phone (MP §1, §10): the Pixel 7 profile with the CPU slowed 4× and
 * Lighthouse's slow 4G (150 ms round trips, 1.6 Mbps). Records the largest paint, layout shift and
 * any long animation frame (over 50 ms) while a visitor scrolls the homepage and changes slides,
 * with the action each long frame coincided with. Three runs, because frame timings vary.
 *
 * Limits of the method: CPU throttling models a slow processor, not a weak GPU or little memory,
 * so GPU-bound work is kept off phones by design instead (no backdrop blur on touch devices;
 * only transform and opacity animate). A recording on a real device remains the final word.
 */
test('the homepage stays smooth on a throttled mid-range phone', async ({ browser }, info) => {
  test.skip(info.project.name !== 'android', 'Pixel 7 profile only');
  test.setTimeout(240_000);
  const runs = [];

  for (let run = 0; run < RUNS; run++) {
    const context = await browser.newContext({ ...devices['Pixel 7'] });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    await page.addInitScript(() => {
      const perf: Perf = { lcp: 0, cls: 0, frames: [] };
      window.__perf = perf;
      new PerformanceObserver((list) => {
        const last = list.getEntries().at(-1);
        if (last) perf.lcp = last.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as (PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
        })[])
          if (!e.hadRecentInput) perf.cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as (PerformanceEntry & {
          blockingDuration: number;
          renderStart: number;
          scripts: { invoker: string; duration: number }[];
        })[])
          perf.frames.push({
            start: e.startTime,
            duration: e.duration,
            blocking: e.blockingDuration,
            render: e.renderStart ? Math.round(e.startTime + e.duration - e.renderStart) : 0,
            scripts: e.scripts.map((s) => `${s.invoker} ${Math.round(s.duration)}ms`),
          });
      }).observe({ type: 'long-animation-frame', buffered: true });
    });

    await page.goto('/', { waitUntil: 'load' });
    await page.waitForTimeout(3000); // hydration and the hero entrance finish
    const start = await page.evaluate(() => performance.now());

    // A visitor reading down the page, then back to the slideshow; each step is marked so a long
    // frame can be traced to what the visitor was doing.
    const mark = (name: string) => page.evaluate((n) => performance.mark(n), name);
    for (let i = 0; i < 14; i++) {
      await mark(`scrolling (step ${i + 1})`);
      await page.mouse.wheel(0, 450);
      await page.waitForTimeout(150);
    }
    await mark('jumping back to the top');
    await page.evaluate(() => window.scrollTo({ top: 0 }));
    await page.waitForTimeout(400);
    await mark('changing slide');
    await page.getByRole('button', { name: 'Next slide' }).click();
    await page.waitForTimeout(1200);

    const perf = await page.evaluate(() => window.__perf);
    const longFrames = await page.evaluate(
      ({ frames, from }) =>
        frames
          .filter((f) => f.start >= from)
          .map((f) => ({
            during:
              performance
                .getEntriesByType('mark')
                .filter((m) => m.startTime <= f.start)
                .at(-1)?.name ?? 'settling',
            durationMs: Math.round(f.duration),
            blockingMs: Math.round(f.blocking),
            renderingMs: f.render,
            scripts: f.scripts,
          })),
      { frames: perf.frames, from: start },
    );
    runs.push({
      lcpMs: Math.round(perf.lcp),
      cls: Number(perf.cls.toFixed(4)),
      longFramesWhileInteracting: longFrames,
      longFramesWhileLoading: perf.frames.filter((f) => f.start < start).length,
    });
    await context.close();
  }

  const result = {
    profile: 'Pixel 7, CPU 4x slower, slow 4G (150 ms RTT, 1.6 Mbps), production build',
    runs,
  };
  info.annotations.push({ type: 'smoothness', description: JSON.stringify(result) });
  if (process.env.WRITE_EVIDENCE) {
    mkdirSync('docs/plan/evidence/phase-03', { recursive: true });
    writeFileSync(
      'docs/plan/evidence/phase-03/smoothness-android.json',
      `${JSON.stringify(result, null, 2)}\n`,
    );
  }

  for (const r of runs) {
    expect(r.lcpMs).toBeLessThanOrEqual(2500);
    expect(r.cls).toBeLessThanOrEqual(0.1);
    // INP target is 200 ms (MP §10). On a 4x-throttled phone no script may block input for more
    // than 50 ms (a long task), and no frame may take longer than 150 ms.
    expect(r.longFramesWhileInteracting.filter((f) => f.blockingMs > 50)).toEqual([]);
    expect(r.longFramesWhileInteracting.filter((f) => f.durationMs > 150)).toEqual([]);
  }
});
