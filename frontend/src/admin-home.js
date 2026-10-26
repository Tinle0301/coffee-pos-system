// admin-home.js — the Admin's landing screen: one tile per admin screen.
// To add a screen to this page, set its `route` (the key in main.js's routes);
// tiles with `route: null` show as "Coming soon". Styles live in admin-home.css.

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
      { route: null, title: 'Transaction Log', description: 'Review payments, refunds and other activity.' },
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
      { route: null, title: 'Staff Accounts', description: 'Add, update or deactivate staff.' },
      { route: null, title: 'Sales Reports', description: 'Daily and weekly sales summaries.' },
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

  init(navigate) {
    document.querySelectorAll('.admin-tile[data-route]').forEach((tile) => {
      tile.addEventListener('click', () => navigate(tile.dataset.route));
    });
  },
};
