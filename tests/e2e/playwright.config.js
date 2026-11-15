// playwright.config.js — POS-80
//
// End-to-end tests run in a real Chromium browser against a deployed site.
//   POS_BASE_URL  which site to test (default: the live site). Use a
//                 Vercel preview URL to test a PR before merging.
// Logins come from environment variables (see each spec), never the repo.

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  expect: { timeout: 15_000 },   // the live database can take a few seconds
  fullyParallel: false,          // one order at a time keeps the queue readable
  workers: 1,
  retries: 0,                    // a flaky step should be fixed, not retried
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.POS_BASE_URL ?? 'https://coffee-pos-system-omega.vercel.app',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // tablet size: the register runs on a counter tablet (POS-72)
    { name: 'tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 } } },
  ],
});
