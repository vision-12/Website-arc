import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Local runs read the same env as `next start`; CI provides variables directly.
if (existsSync('.env.local')) process.loadEnvFile('.env.local');

const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  // The approval-workflow test switches a site-wide setting, so it runs alone after the rest.
  projects: [
    {
      name: 'desktop',
      testIgnore: /approval\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 2,
      },
    },
    {
      name: 'mobile-360',
      testIgnore: /approval\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 360, height: 740 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
    { name: 'android', testIgnore: /approval\.spec\.ts/, use: { ...devices['Pixel 7'] } },
    {
      name: 'approval',
      testMatch: /approval\.spec\.ts/,
      dependencies: ['desktop', 'mobile-360', 'android'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  // Runs against a production build (`npm run build` first) so CSP and caching behave as in production.
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
