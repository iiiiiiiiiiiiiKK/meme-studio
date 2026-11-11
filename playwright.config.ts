import { defineConfig, devices } from '@playwright/test';

/**
 * Port for the local preview server.
 *
 * It is overridable because Windows can reserve a port range (Hyper-V / WinNAT),
 * which makes a hard-coded port fail with `EACCES` on an otherwise idle machine.
 */
export const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 4388);

/**
 * Two real browser projects:
 *  - `desktop-chromium` runs the full functional suite on a 1440×900 viewport.
 *  - `mobile-webkit` runs the responsive suite in WebKit with an iPhone 13
 *    profile, because WebKit is the engine Safari/iOS actually uses.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
        },
      },
    },
    {
      name: 'mobile-webkit',
      use: { ...devices['iPhone 13'] },
      testMatch: /mobile\.spec\.ts/,
    },
  ],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
});
