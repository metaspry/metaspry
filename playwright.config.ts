import { defineConfig } from '@playwright/test';

// E2E for the built extension. `npm run test:e2e` builds first; the suite loads build/ unpacked
// (see e2e/fixtures.ts), so a stale build/ tests stale code.
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  // One persistent Chromium profile per test, and the extension's storage is per profile: tests
  // are isolated, but parallel Chromium instances with extensions are flaky on Windows.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node e2e/server.mjs',
    // Fixed port: e2e/site/ hardcodes it (canonical, og:url, robots.txt, sitemap.xml).
    url: 'http://127.0.0.1:4319/llms.txt',
    reuseExistingServer: !process.env.CI,
  },
});
