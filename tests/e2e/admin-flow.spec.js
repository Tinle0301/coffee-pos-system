// admin-flow.spec.js — POS-81
//
// End-to-end test of the admin's screens, in a real browser: log in as the
// test admin, open every Admin Home screen and check that each one loads
// its data without an error, then use the two most important tools (run a
// Day report, filter the transaction log). It also checks that a barista
// can't open the admin screens.
//
// Read-only except for one saved Day report (running a report saves it).
// Logins come from environment variables, never this repo:
//
//   POS_ADMIN_EMAIL=... POS_ADMIN_PASSWORD=... npx playwright test admin-flow
//   (POS_BARISTA_EMAIL / POS_BARISTA_PASSWORD too, for the barista check)

import { test, expect } from '@playwright/test';
import { credentials, logIn, expectNoErrorShown, todayInShop } from './helpers.js';

const admin = credentials('admin');
const barista = credentials('barista');

// Every Admin Home tile, and what shows up once that screen has its data.
//   ready:   appears only after the data has loaded (or the "none yet" row)
//   loading: containers that say "Loading..." until the data arrives
const SCREENS = [
  { route: 'new-order',    name: 'New Order',         heading: null,                ready: '#menu-rows tr' },
  { route: 'queue',        name: 'Active Orders',     heading: 'Active Orders',     ready: '#queue-list li' },
  { route: 'refund',       name: 'Refunds',           heading: 'Refund a Payment',  ready: '#refund-recent li, #refund-recent-msg:not(:empty)' },
  { route: 'transactions', name: 'Transaction Log',   heading: 'Transaction Log',   ready: '#log-rows tr' },
  { route: 'menu',         name: 'Menu Management',   heading: 'Menu Management',   loading: ['#menu-categories'] },
  { route: 'inventory',    name: 'Inventory',         heading: 'Inventory',         loading: ['#inventory-list'] },
  { route: 'staff',        name: 'Staff Accounts',    heading: 'Staff',             ready: '#staff-list li' },
  { route: 'reports',      name: 'Reports Dashboard', heading: 'Reports Dashboard', loading: ['#rd-best', '#rd-hours', '#rd-pay'] },
  { route: 'sales-report', name: 'Sales Reports',     heading: 'Sales Report',      ready: '#past-rows tr' },
];

/** Wait until a screen has finished loading its data. */
async function waitForScreen(page, screen) {
  if (screen.heading) await expect(page.getByRole('heading', { name: screen.heading, exact: true })).toBeVisible();
  if (screen.ready) await expect(page.locator(screen.ready).first(), `${screen.name} never finished loading`).toBeVisible();
  for (const box of screen.loading ?? []) {
    await expect(page.locator(box), `${screen.name} is stuck on "Loading..."`).not.toContainText('Loading');
  }
}

async function openAdminHome(page) {
  await page.locator('#header-admin-home-btn').click();
  await expect(page.locator('.admin-tile').first()).toBeVisible();
}

test.describe('Admin flow', () => {
  test.skip(!admin.email || !admin.password, 'Set POS_ADMIN_EMAIL and POS_ADMIN_PASSWORD to run the admin flow');

  test('Admin Home opens after login and shows every admin screen', async ({ page }) => {
    await logIn(page, admin);
    await expect(page.locator('.app-header')).toBeVisible();
    await expect(page.locator('#header-admin-home-btn')).toBeVisible();

    for (const screen of SCREENS) {
      await expect(page.locator(`.admin-tile[data-route="${screen.route}"]`), `No ${screen.name} tile on Admin Home`).toBeVisible();
    }
    await expect(page.locator('.admin-tile--soon')).toHaveCount(0); // no "Coming soon" tiles left
  });

  test('every Admin Home screen loads its data without an error', async ({ page }) => {
    await logIn(page, admin);
    await expect(page.locator('.admin-tile').first()).toBeVisible();

    for (const screen of SCREENS) {
      await test.step(screen.name, async () => {
        await openAdminHome(page);
        await page.locator(`.admin-tile[data-route="${screen.route}"]`).click();
        await waitForScreen(page, screen);
        await expectNoErrorShown(page, screen.name);
      });
    }

    await test.step("Today's Orders (header button)", async () => {
      await page.locator('#header-todays-orders-btn').click();
      await expect(page.locator('#todays-list li').first()).toBeVisible();
      await expectNoErrorShown(page, "Today's Orders");
    });
  });

  test('run a Day report for today', async ({ page }) => {
    await logIn(page, admin);
    await openAdminHome(page);
    await page.locator('.admin-tile[data-route="sales-report"]').click();

    await page.locator('#report-date').fill(todayInShop());
    await page.getByRole('radio', { name: 'Day' }).check();
    await page.locator('#report-run-btn').click();

    await expect(page.locator('#report-result')).toBeVisible();
    await expect(page.locator('#report-total')).toHaveText(/^\$\d[\d,]*\.\d{2}$/);
    await expectNoErrorShown(page, 'Sales Report');
  });

  test('filter the transaction log to today', async ({ page }) => {
    await logIn(page, admin);
    await openAdminHome(page);
    await page.locator('.admin-tile[data-route="transactions"]').click();
    await expect(page.locator('#log-rows tr').first()).toBeVisible();

    const today = todayInShop();
    await page.locator('#log-from').fill(today);
    await page.locator('#log-to').fill(today);
    await page.locator('#log-apply-btn').click();

    await expect(page.locator('#log-apply-btn')).toBeEnabled(); // finished loading
    await expect(page.locator('#log-rows tr').first()).toBeVisible();
    await expectNoErrorShown(page, 'Transaction Log');

    // Export is only offered when there are entries to export
    const hasEntries = (await page.locator('#log-rows td.order-empty').count()) === 0;
    await expect(page.locator('#log-export-btn')).toBeEnabled({ enabled: hasEntries });
  });
});

test.describe('Admin screens are for admins only', () => {
  test.skip(!barista.email || !barista.password, 'Set POS_BARISTA_EMAIL and POS_BARISTA_PASSWORD for this check');

  test('a barista lands on New Order and has no Admin Home button', async ({ page }) => {
    await logIn(page, barista);
    await expect(page.locator('.app-header')).toBeVisible();
    await expect(page.locator('#menu-rows tr').first()).toBeVisible();
    await expect(page.locator('#header-admin-home-btn')).toHaveCount(0);
    await expect(page.locator('.admin-tile')).toHaveCount(0);
  });
});
