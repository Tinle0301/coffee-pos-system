// helpers.js — POS-81
// Shared steps for the end-to-end tests (barista-flow and admin-flow).

import { expect } from '@playwright/test';

/** The login for a role, from environment variables (never the repo). */
export function credentials(role) {
  const prefix = role === 'admin' ? 'POS_ADMIN' : 'POS_BARISTA';
  return { email: process.env[`${prefix}_EMAIL`], password: process.env[`${prefix}_PASSWORD`] };
}

/** Open the site and log in from the Login screen. */
export async function logIn(page, { email, password }) {
  const response = await page.goto('/');
  expect(response?.ok(), `Could not open ${page.url()} (HTTP ${response?.status()}). Check POS_BASE_URL.`).toBeTruthy();
  await expect(
    page.locator('#login-email'),
    `No Login screen at ${page.url()}. If it shows a Vercel login page, the preview is protected: test the live site instead (unset POS_BASE_URL).`
  ).toBeVisible();
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.locator('#login-submit').click();
}

/**
 * Fail if the screen shows an error message: the red status lines
 * (.error, .rd-error) and alert boxes with text in them.
 */
export async function expectNoErrorShown(page, screenName) {
  const errors = page.locator('.error:visible, .rd-error:visible, [role="alert"]:visible').filter({ hasText: /\S/ });
  const texts = await errors.allTextContents();
  expect(texts, `${screenName} shows an error: ${texts.join(' | ')}`).toEqual([]);
}

/** Today's date in the shop's time zone, as YYYY-MM-DD (what date inputs use). */
export function todayInShop() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
}
