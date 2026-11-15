// playwright.config.js — POS-80
//
// End-to-end tests run in a real Chromium browser against a deployed site.
//   POS_BASE_URL  which site to test (default: the live site). Use a
//                 Vercel preview URL to test a PR before merging.
// Logins come from environment variables (see each spec), never the repo.

import { defineConfig, devices } from '@playwright/test';

const LIVE_SITE = 'https://coffee-pos-system-omega.vercel.app';

// An empty POS_BASE_URL means the live site. Anything else must be a full
// http(s) address; fail right away with a clear message instead of every
// test timing out on a page that never opened.
function baseUrl() {
  const raw = (process.env.POS_BASE_URL ?? '').trim();
  if (!raw) return LIVE_SITE;
  let url;
  try {
    url = new URL(raw);
  } catch {
    url = null;
  }
  if (!url || !['http:', 'https:'].includes(url.protocol) || /[<>]/.test(raw)) {
    throw new Error(
      `POS_BASE_URL is not a valid web address: "${raw}". Set it to the full preview URL ` +
      `(e.g. https://coffee-pos-system-git-....vercel.app), or run "unset POS_BASE_URL" to test the live site.`
    );
  }
  return url.origin;
}

export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  expect: { timeout: 15_000 },   // the live database can take a few seconds
  fullyParallel: false,          // one order at a time keeps the queue readable
  workers: 1,
  retries: 0,                    // a flaky step should be fixed, not retried
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: baseUrl(),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // tablet size: the register runs on a counter tablet (POS-72)
    { name: 'tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 } } },
  ],
});
