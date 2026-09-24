// Real backend module — Nghia's menu.js is implemented, no longer a stub.
import { listMenuItems } from '../../backend/services/menu.js';

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
      // error.message comes from the real menu.js contract — already
      // written to be safe to show as-is.
      container.innerHTML = `<div class="error">${error.message}</div>`;
      return;
    }

    if (items) {
      const categorized = this.groupByCategory(items);
      container.innerHTML = this.generateMenuHTML(categorized);
    }
  },
  // Story #11: group the flat item list into { [category]: item[] }
  // NOTE: field names are camelCase (menuItemCategoryType, etc.) — the
  // real backend/services/menu.js maps snake_case DB columns to camelCase
  // before returning them (see its toMenuItem() function).
  groupByCategory(items) {
    return items.reduce((groups, item) => {
      const category = item.menuItemCategoryType;
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
            const isAvailable = item.menuItemAvailabilityStatus;
            const disabledAttrs = isAvailable ? '' : 'disabled class="item-disabled"';
            const label = isAvailable
              ? item.menuItemName
              : `${item.menuItemName} (Unavailable)`;

            return `
              <button class="menu-item-btn" data-item-id="${item.menuItemIdentifier}" ${disabledAttrs}>
                <span class="item-name">${label}</span>
                <span class="item-price">$${item.menuItemPriceAmount.toFixed(2)}</span>
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
