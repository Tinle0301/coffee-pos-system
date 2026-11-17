// session-timeout.spec.js
// The register signs itself out after 10 minutes with no taps or typing
// (491A SRS, docs/REQUIREMENTS.md). Playwright's fake clock fast-forwards
// the 10 minutes, so the test takes seconds, not minutes.

import { test, expect } from '@playwright/test';
import { credentials, logIn } from './helpers.js';

const barista = credentials('barista');

test.describe('Session timeout', () => {
  test.skip(!barista.email || !barista.password, 'Set POS_BARISTA_EMAIL and POS_BARISTA_PASSWORD for the timeout test');

  test('signs out after 10 minutes idle, but not while someone is using it', async ({ page }) => {
    await page.clock.install();
    await logIn(page, barista);
    await expect(page.locator('.app-header')).toBeVisible();

    // 9 minutes idle, then a tap: the 10 minutes start over
    await page.clock.fastForward('09:00');
    await page.locator('#menu-rows').click();
    await page.clock.fastForward('09:00');
    await expect(page.locator('.app-header')).toBeVisible();

    // 10+ minutes with nothing → back to Login
    await page.clock.fastForward('10:30');
    await expect(page.locator('#login-form')).toBeVisible();
    await expect(page.locator('.app-header')).toHaveCount(0);

    // and it stays signed out after a reload
    await page.reload();
    await expect(page.locator('#login-form')).toBeVisible();
  });
});
