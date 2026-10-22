// menu.js — admin Menu Management: lists every item by category and lets an
// Admin switch each one on or off. An item that is off is "sold out": it
// disappears from the New Order screen (see new-order.js).
// Writes go through updateMenuItem; RLS (menu_items_write_admin) is the real
// admin check, the route guard in main.js is only a convenience.
import { listMenuItems, updateMenuItem } from './backend/services/menu.js';

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const formatPrice = (amount) => `$${Number(amount ?? 0).toFixed(2)}`;

export const menuScreen = {
  render() {
    return `
      <div class="screen-container menu-admin">
        <div class="menu-admin-top">
          <button type="button" id="menu-back-btn" class="btn-ghost">&larr; Admin Home</button>
        </div>
        <h2>Menu Management</h2>
        <p class="menu-admin-hint">Switch an item off when it sells out and it disappears from New Order. Switch it back on when it's available again.</p>
        <p id="menu-admin-summary" class="menu-admin-summary" aria-live="polite"></p>
        <p id="menu-admin-message" class="menu-admin-message" role="status" aria-live="polite"></p>
        <div id="menu-categories">Loading menu...</div>
      </div>
    `;
  },

  async init(navigate) {
    document.getElementById('menu-back-btn').addEventListener('click', () => navigate('admin'));

    const container = document.getElementById('menu-categories');
    const summary = document.getElementById('menu-admin-summary');
    const message = document.getElementById('menu-admin-message');

    const { data, error } = await listMenuItems();
    if (error) {
      // The service's messages are written to be safe to show as-is.
      container.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
      return;
    }

    let items = data || [];
    if (items.length === 0) {
      container.textContent = 'No menu items yet.';
      return;
    }

    const draw = () => {
      container.innerHTML = this.generateMenuHTML(this.groupByCategory(items));
      const on = items.filter((i) => i.menuItemAvailabilityStatus).length;
      summary.textContent = `${on} of ${items.length} items on`;
    };
    draw();

    const pending = new Set(); // ids with a request in flight (double-tap protection)

    container.addEventListener('click', async (event) => {
      const toggle = event.target.closest('.menu-toggle');
      if (!toggle || toggle.disabled) return;
      const id = toggle.dataset.itemId;
      if (pending.has(id)) return;
      const item = items.find((i) => String(i.menuItemIdentifier) === id);
      if (!item) return;

      pending.add(id);
      toggle.disabled = true;
      message.textContent = '';
      message.classList.remove('is-error');

      const next = !item.menuItemAvailabilityStatus;
      const { data: updated, error: updateError } = await updateMenuItem(item.menuItemIdentifier, {
        menuItemAvailabilityStatus: next,
      });
      pending.delete(id);

      if (updateError || !updated) {
        message.textContent = `Couldn't update ${item.menuItemName}. ${updateError?.message || 'Please try again.'}`;
        message.classList.add('is-error');
        draw();
        return;
      }

      items = items.map((i) => (i.menuItemIdentifier === item.menuItemIdentifier ? { ...i, menuItemAvailabilityStatus: next } : i));
      message.textContent = `${item.menuItemName} is now ${next ? 'available' : 'sold out'}.`;
      draw();
    });
  },

  // Group the flat item list into { [category]: item[] }.
  // Field names are camelCase — backend/services/menu.js maps the DB columns.
  groupByCategory(items) {
    return items.reduce((groups, item) => {
      const category = item.menuItemCategoryType;
      if (!groups[category]) groups[category] = [];
      groups[category].push(item);
      return groups;
    }, {});
  },

  // One section per category, one row per item with an on/off switch.
  generateMenuHTML(categorizedItems) {
    return Object.entries(categorizedItems)
      .map(([category, items]) => {
        const rows = items
          .map((item) => {
            const on = Boolean(item.menuItemAvailabilityStatus);
            return `
              <li class="menu-admin-row${on ? '' : ' is-off'}">
                <div class="menu-admin-info">
                  <span class="menu-admin-name">${escapeHtml(item.menuItemName)}</span>
                  <span class="menu-admin-price">${formatPrice(item.menuItemPriceAmount)}</span>
                </div>
                <span class="menu-admin-status">${on ? 'Available' : 'Sold out'}</span>
                <button type="button" class="menu-toggle${on ? ' is-on' : ''}" role="switch"
                  aria-checked="${on}" aria-label="${escapeHtml(item.menuItemName)} available"
                  data-item-id="${escapeHtml(item.menuItemIdentifier)}">
                  <span class="menu-toggle-knob"></span>
                </button>
              </li>`;
          })
          .join('');

        return `
          <section class="menu-admin-category">
            <h3>${escapeHtml(category)}</h3>
            <ul class="menu-admin-list">${rows}</ul>
          </section>`;
      })
      .join('');
  },
};
