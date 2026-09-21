// TEMPORARY: using the frontend stub per the sprint guide's "don't wait for
// backend" rule. Swap this for '../../backend/services/menu.js' the moment
// real module (see docs/API_CONTRACT.md) merges.
import { listMenuItems } from '../services/menu.stub.js';

export const menuScreen = {
  render() {
    return `
      <div class="screen-container">
        <h2>Menu Management</h2>
        <div id="menu-categories">Fetching live items...</div>
        <button id="go-to-confirm-btn">Proceed to Confirmation</button>
      </div>
    `;
  },
  async init(navigate) {
    document.getElementById('go-to-confirm-btn').addEventListener('click', () => navigate('confirm'));

    const { data: items, error } = await listMenuItems();
    const container = document.getElementById('menu-categories');

    if (error) {
      container.innerHTML = `<div class="error">Could not load the menu — try again</div>`;
      return;
    }

    if (items) {
      const categorized = this.groupByCategory(items);
      container.innerHTML = this.generateMenuHTML(categorized);
    }
  },
  // Story #11: group the flat item list into { [category]: item[] }
  groupByCategory(items) {
    return items.reduce((groups, item) => {
      const category = item.menu_item_category_type;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(item);
      return groups;
    }, {});
  },
  // Story #11: render each category as a section, dimming/disabling unavailable items
  generateMenuHTML(categorizedItems) {
    return Object.entries(categorizedItems)
      .map(([category, items]) => {
        const itemsHtml = items
          .map((item) => {
            const isAvailable = item.menu_item_availability_status;
            const disabledAttrs = isAvailable ? '' : 'disabled class="item-disabled"';
            const label = isAvailable
              ? item.menu_item_name
              : `${item.menu_item_name} (Unavailable)`;

            return `
              <button class="menu-item-btn" data-item-id="${item.menu_item_identifier}" ${disabledAttrs}>
                <span class="item-name">${label}</span>
                <span class="item-price">$${item.menu_item_price_amount.toFixed(2)}</span>
              </button>
            `;
          })
          .join('');

        return `
          <div class="category-section">
            <h3>${category}</h3>
            <div class="items-grid">${itemsHtml}</div>
          </div>
        `;
      })
      .join('');
  }
};

