// barista-flow.spec.js — POS-80
//
// End-to-end test of the barista's whole shift loop, in a real browser:
// log in → add items → submit → pay → the order shows up on Active Orders
// and Today's Orders → move it to Completed.
//
// It runs against a real deployment (the live site by default, or a Vercel
// preview with POS_BASE_URL), so it creates a real order each run. Use the
// test barista account, never a real person's login. The login comes from
// environment variables and is never written in this repo:
//
//   POS_BARISTA_EMAIL=... POS_BARISTA_PASSWORD=... npx playwright test barista-flow
//
// Every test opens a fresh browser context, so tests never share a login
// (the same-browser session clash from Sprint 3 can't happen here).

import { test, expect } from '@playwright/test';

const EMAIL = process.env.POS_BARISTA_EMAIL;
const PASSWORD = process.env.POS_BARISTA_PASSWORD;

test.skip(!EMAIL || !PASSWORD, 'Set POS_BARISTA_EMAIL and POS_BARISTA_PASSWORD to run the barista flow');

/** Log in from the Login screen and wait for the register to load. */
async function logIn(page, email = EMAIL, password = PASSWORD) {
  await page.goto('/');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.locator('#login-submit').click();
}

/**
 * Add one menu item to the order. Drinks open the customize window first
 * (size, milk, add-ons); its defaults are fine, so just confirm it.
 */
async function addFirstMenuItem(page) {
  const firstAdd = page.locator('#menu-rows .add-btn').first();
  await expect(firstAdd).toBeVisible();
  await firstAdd.click();
  const modal = page.locator('#customize-modal');
  if (await modal.isVisible()) await page.locator('#modal-add').click();
}

/**
 * New Order → Confirm → Submit. Returns the new order id from the
 * Payment screen.
 */
async function placeOrder(page) {
  await addFirstMenuItem(page);
  await expect(page.locator('#order-list li')).toHaveCount(1);
  await expect(page.locator('#order-total')).not.toHaveText('$0.00');

  await page.locator('#go-to-confirm-btn').click();
  await page.locator('#confirm-order-btn').click();

  const orderNumber = page.locator('#payment-order-number');
  await expect(orderNumber).not.toHaveText('');
  return (await orderNumber.textContent()).trim();
}

test.describe('Barista flow', () => {
  test('a wrong password shows an error and stays on Login', async ({ page }) => {
    await logIn(page, EMAIL, `${PASSWORD}-wrong`);

    await expect(page.locator('#login-error')).toBeVisible();
    await expect(page.locator('#login-error')).toHaveText('Incorrect email or password.');
    await expect(page.locator('.app-header')).toHaveCount(0);
  });

  test('log in, order, pay cash, see it on the queue and Today\'s Orders, complete it', async ({ page }) => {
    // 1. Log in → the register (New Order) opens, with the header
    await logIn(page);
    await expect(page.locator('.app-header')).toBeVisible();
    await expect(page.locator('#menu-rows tr').first()).toBeVisible();

    // 2–3. Add an item, submit it to the kitchen
    const orderId = await placeOrder(page);
    const shortId = orderId.slice(0, 8);

    // 4. Pay cash with exact change
    const total = (await page.locator('#payment-total').textContent()).replace(/[^0-9.]/g, '');
    await page.getByRole('radio', { name: 'Cash' }).check();
    await page.locator('#cash-received').fill(total);
    await expect(page.locator('#change-due')).toHaveText('$0.00');
    await page.locator('#complete-sale-btn').click();
    await expect(page.locator('#payment-status')).toHaveText('Sale complete. Give $0.00 change.');

    // 5. Active Orders: paid orders stay on the queue until they're made
    await page.locator('#header-active-orders-btn').click();
    const queueButton = page.locator(`#queue-list button[data-order-id="${orderId}"]`);
    await expect(page.locator('#queue-list')).toContainText(`Order #${shortId}`);

    // Start (Pending → In Progress), then Complete (In Progress → Completed)
    if ((await queueButton.textContent()).trim() === 'Start') {
      await queueButton.click();
      await expect(queueButton).toHaveText('Complete');
    }
    await queueButton.click();
    await expect(page.locator('#queue-list')).not.toContainText(`Order #${shortId}`);

    // 6. Today's Orders shows it as Completed and paid in cash
    await page.locator('#header-todays-orders-btn').click();
    const row = page.locator(`#todays-list li[data-order-id="${orderId}"]`);
    await expect(row).toContainText('Completed');
    await expect(row).toContainText('Paid · Cash');
  });

  test('pay by card', async ({ page }) => {
    await logIn(page);
    const orderId = await placeOrder(page);

    // The barista taps "Card"; it must be saved as Credit/Debit (the only card
    // method the database accepts), and the sale must go through.
    await page.getByRole('radio', { name: 'Card' }).check();
    await page.locator('#complete-sale-btn').click();
    await expect(page.locator('#payment-status')).toHaveText('Sale complete.');

    await page.locator('#header-todays-orders-btn').click();
    await expect(page.locator(`#todays-list li[data-order-id="${orderId}"]`)).toContainText('Paid · Credit/Debit');
  });

  test('log out returns to Login and stays logged out after a reload', async ({ page }) => {
    await logIn(page);
    await expect(page.locator('.app-header')).toBeVisible();

    await page.locator('#global-logout-btn').click();
    await expect(page.locator('#login-form')).toBeVisible();

    await page.reload();
    await expect(page.locator('#login-form')).toBeVisible();
    await expect(page.locator('.app-header')).toHaveCount(0);
  });
});
