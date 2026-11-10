// admin-home.js — the Admin's landing screen: one tile per admin screen.
// The Inventory tile also shows a live count of low-stock items (see below).
// To add a screen to this page, set its `route` (the key in main.js's routes);
// tiles with `route: null` show as "Coming soon". Styles live in admin-home.css.

import { listInventory } from './inventory-api.js';
import { countByLevel } from './stock-level.js';

export const ADMIN_SECTIONS = [
  {
    heading: 'Barista screens',
    tiles: [
      { route: 'new-order', title: 'New Order', description: 'Ring up a customer order, the same screen baristas use.' },
      { route: 'queue', title: 'Active Orders', description: 'See what the bar is making and mark orders In Progress or Completed.' },
    ],
  },
  {
    heading: 'Payments',
    tiles: [
      { route: 'refund', title: 'Refunds', description: 'Refund a completed payment in full or in part.' },
      { route: 'transactions', title: 'Transaction Log', description: 'Review payments, refunds and other activity.' },
    ],
  },
  {
    heading: 'Store',
    tiles: [
      { route: 'menu', title: 'Menu Management', description: 'Review menu items, prices and availability.' },
      { route: 'inventory', title: 'Inventory', description: 'See stock levels, with low items highlighted.' },
    ],
  },
  {
    heading: 'People and reports',
    tiles: [
      { route: 'staff', title: 'Staff Accounts', description: 'See staff and deactivate accounts.' },
      { route: 'reports', title: 'Reports Dashboard', description: 'Best sellers, busiest hours and payment breakdown at a glance.' },
      { route: 'sales-report', title: 'Sales Reports', description: 'Daily and weekly sales summaries.' },
    ],
  },
];

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderTile(tile, index) {
  const style = `style="--i:${index}"`;
  if (!tile.route) {
    return `
      <button type="button" class="admin-tile admin-tile--soon" disabled aria-disabled="true" ${style}>
        <span class="admin-tile-title">${escapeHtml(tile.title)}</span>
        <span class="admin-tile-desc">${escapeHtml(tile.description)}</span>
        <span class="admin-tile-badge">Coming soon</span>
      </button>`;
  }
  return `
    <button type="button" class="admin-tile" data-route="${escapeHtml(tile.route)}" ${style}>
      <span class="admin-tile-title">${escapeHtml(tile.title)}</span>
      <span class="admin-tile-desc">${escapeHtml(tile.description)}</span>
      <span class="admin-tile-go" aria-hidden="true">Open &rarr;</span>
      ${tile.route === 'inventory' ? '<span class="admin-tile-alert" data-alert="inventory" aria-live="polite" hidden></span>' : ''}
    </button>`;
}

export const adminHomeScreen = {
  render(state) {
    // The route guard in main.js is the first check; this is a second one.
    if (!state || state.staffRole !== 'Admin') {
      return `
        <div class="admin-home">
          <div class="admin-home-denied" role="alert">
            <h2>Admins only</h2>
            <p>You don't have access to this screen.</p>
          </div>
        </div>`;
    }

    let index = 0;
    const groups = ADMIN_SECTIONS.map(
      (section, i) => `
        <section class="admin-home-group" aria-labelledby="admin-group-${i}">
          <h3 class="admin-home-group-title" id="admin-group-${i}">${escapeHtml(section.heading)}</h3>
          <div class="admin-home-grid">${section.tiles.map((tile) => renderTile(tile, index++)).join('')}</div>
        </section>`
    ).join('');

    const welcome = state.staffName ? `Welcome, ${escapeHtml(state.staffName)}. ` : '';
    return `
      <div class="admin-home">
        <header class="admin-home-hero">
          <h2>Admin Home</h2>
          <p>${welcome}Pick a screen to get started.</p>
        </header>
        ${groups}
      </div>`;
  },

  async init(navigate) {
    document.querySelectorAll('.admin-tile[data-route]').forEach((tile) => {
      tile.addEventListener('click', () => navigate(tile.dataset.route));
    });
    await showInventoryAlert();
  },
};

/**
 * What the Inventory tile's badge says. "Low" counts every item at or below its
 * reorder level, including ones that are completely out (same rule as the
 * Inventory screen and the backend's POS-57 report).
 * @returns {{ text: string, level: 'ok' | 'low' | 'out' }}
 */
export function inventoryAlert(items) {
  const { out, low } = countByLevel(items);
  const lowTotal = out + low;
  if (lowTotal === 0) return { text: 'All stocked', level: 'ok' };
  return { text: out ? `${lowTotal} low \u00b7 ${out} out` : `${lowTotal} low`, level: out ? 'out' : 'low' };
}

// Loads stock levels and fills the Inventory tile's badge. A failure just
// leaves the badge hidden: Admin Home still works, and nothing alarming shows.
async function showInventoryAlert() {
  const badge = document.querySelector('[data-alert="inventory"]');
  if (!badge) return; // not an admin view, or the tile isn't on the page
  try {
    const { data, error } = await listInventory();
    if (error || !Array.isArray(data)) return;
    const el = document.querySelector('[data-alert="inventory"]'); // may have navigated away
    if (!el) return;
    const { text, level } = inventoryAlert(data);
    el.textContent = text;
    el.className = `admin-tile-alert is-${level}`;
    el.hidden = false;
  } catch {
    // leave the badge hidden
  }
}
