// new-order.js
// Story #9/#10: build an order — customize size/milk/add-ons, running totals.
// Wired as its own route so it doesn't replace menuScreen's "Menu
// Management" screen — this is the richer build-the-order experience.
import { listMenuItems } from '../../backend/services/menu.js';

const SIZE_OPTIONS = [
  { id: 'small', label: 'Small', delta: 0 },
  { id: 'medium', label: 'Medium', delta: 0.50 },
  { id: 'large', label: 'Large', delta: 1.00 },
];

const MILK_OPTIONS = [
  { id: 'whole', label: 'Whole', delta: 0 },
  { id: 'skim', label: 'Skim', delta: 0 },
  { id: 'oat', label: 'Oat', delta: 0.60 },
  { id: 'almond', label: 'Almond', delta: 0.60 },
];

const ADDON_OPTIONS = [
  { id: 'extra_shot', label: 'Extra shot', delta: 0.75 },
  { id: 'whipped_cream', label: 'Whipped cream', delta: 0.50 },
  { id: 'decaf', label: 'Decaf', delta: 0 },
];

function round2(amount) {
  return Math.round(amount * 100) / 100;
}

const TAX_RATE = 0.1025;

function formatPrice(amount) {
  return `$${amount.toFixed(2)}`;
}

export const newOrderScreen = {
  render() {
    return `
      <div class="new-order-layout">
        <section class="screen-container menu-panel" aria-label="Menu">
          <h2>New Order</h2>
          <div id="category-tabs" class="category-tabs" role="tablist"></div>
          <table class="menu-table">
            <thead><tr><th>Item</th><th>Price</th><th></th></tr></thead>
            <tbody id="menu-rows"></tbody>
          </table>
        </section>

        <aside class="screen-container order-panel" aria-label="Current order">
          <h2>Order</h2>
          <ul id="order-list" class="order-list"></ul>
          <p id="order-empty" class="order-empty">No items added yet.</p>
          <div class="order-totals">
            <div class="order-totals-row"><span>Subtotal</span><span id="order-subtotal">$0.00</span></div>
            <div class="order-totals-row"><span>Tax</span><span id="order-tax">$0.00</span></div>
            <div class="order-totals-row total"><span>Total</span><span id="order-total">$0.00</span></div>
          </div>
          <button id="go-to-confirm-btn">Proceed to Confirmation</button>
        </aside>
      </div>

      <div id="customize-modal" class="modal-overlay" hidden>
        <div class="screen-container modal-card" role="dialog" aria-modal="true">
          <h2 id="customize-title"></h2>
          <fieldset class="modal-field"><legend>Size</legend><div id="size-options" class="option-row"></div></fieldset>
          <fieldset class="modal-field"><legend>Milk</legend><div id="milk-options" class="option-row"></div></fieldset>
          <fieldset class="modal-field"><legend>Add-ons</legend><div id="addon-options" class="option-col"></div></fieldset>
          <div class="modal-actions">
            <button type="button" id="modal-cancel" class="btn-ghost">Cancel</button>
            <button type="button" id="modal-add">Add to order</button>
          </div>
        </div>
      </div>
    `;
  },

  async init(navigate, currentOrder) {
    let allItems = [];
    let activeCategory = null;
    let activeItem = null;

    const categoryTabs = document.getElementById('category-tabs');
    const menuRows = document.getElementById('menu-rows');
    const orderList = document.getElementById('order-list');
    const orderEmpty = document.getElementById('order-empty');
    const subtotalEl = document.getElementById('order-subtotal');
    const taxEl = document.getElementById('order-tax');
    const totalEl = document.getElementById('order-total');
    const modal = document.getElementById('customize-modal');
    const modalTitle = document.getElementById('customize-title');
    const sizeOptionsEl = document.getElementById('size-options');
    const milkOptionsEl = document.getElementById('milk-options');
    const addonOptionsEl = document.getElementById('addon-options');

    document.getElementById('go-to-confirm-btn').addEventListener('click', () => navigate('confirm'));

    function renderTabs(categories) {
      categoryTabs.innerHTML = '';
      categories.forEach((category) => {
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'category-tab' + (category === activeCategory ? ' active' : '');
        tab.textContent = category;
        tab.addEventListener('click', () => {
          activeCategory = category;
          renderTabs(categories);
          renderRows();
        });
        categoryTabs.appendChild(tab);
      });
    }

    function renderRows() {
      menuRows.innerHTML = '';
      for (const item of allItems.filter((i) => i.menuItemCategoryType === activeCategory)) {
        const tr = document.createElement('tr');
        if (!item.menuItemAvailabilityStatus) tr.classList.add('menu-row-unavailable');

        const nameTd = document.createElement('td');
        nameTd.className = 'menu-row-name';
        nameTd.textContent = item.menuItemName;

        const priceTd = document.createElement('td');
        priceTd.className = 'menu-row-price';
        priceTd.textContent = item.menuItemAvailabilityStatus ? formatPrice(item.menuItemPriceAmount) : 'Unavailable';

        const actionTd = document.createElement('td');
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'add-btn';
        addBtn.textContent = 'Add';
        addBtn.disabled = !item.menuItemAvailabilityStatus;
        addBtn.addEventListener('click', () => {
          // Every item opens the customize modal — size/milk/add-ons are
          // optional there, so this works whether or not it's a drink.
          openCustomizeModal(item);
        });
        actionTd.appendChild(addBtn);

        tr.append(nameTd, priceTd, actionTd);
        menuRows.appendChild(tr);
      }
    }

    function openCustomizeModal(item) {
      activeItem = item;
      modalTitle.textContent = item.menuItemName;
      sizeOptionsEl.innerHTML = '';
      SIZE_OPTIONS.forEach((o, i) => sizeOptionsEl.appendChild(radio('size', o, i === 0)));
      milkOptionsEl.innerHTML = '';
      MILK_OPTIONS.forEach((o, i) => milkOptionsEl.appendChild(radio('milk', o, i === 0)));
      addonOptionsEl.innerHTML = '';
      ADDON_OPTIONS.forEach((o) => addonOptionsEl.appendChild(checkbox('addon', o)));
      modal.hidden = false;
    }

    function radio(name, opt, checked) {
      const label = document.createElement('label');
      label.className = 'option-pill';
      label.innerHTML = `<input type="radio" name="${name}" value="${opt.id}" ${checked ? 'checked' : ''}/> <span>${opt.label}${opt.delta > 0 ? ` (+${formatPrice(opt.delta)})` : ''}</span>`;
      return label;
    }

    function checkbox(name, opt) {
      const label = document.createElement('label');
      label.className = 'option-pill';
      label.innerHTML = `<input type="checkbox" name="${name}" value="${opt.id}"/> <span>${opt.label}${opt.delta > 0 ? ` (+${formatPrice(opt.delta)})` : ''}</span>`;
      return label;
    }

    document.getElementById('modal-cancel').addEventListener('click', () => { modal.hidden = true; });
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.hidden = true; });

    document.getElementById('modal-add').addEventListener('click', () => {
      if (!activeItem) return;
      const size = SIZE_OPTIONS.find((o) => o.id === modal.querySelector('input[name="size"]:checked').value);
      const milk = MILK_OPTIONS.find((o) => o.id === modal.querySelector('input[name="milk"]:checked').value);
      const addons = ADDON_OPTIONS.filter((o) =>
        [...modal.querySelectorAll('input[name="addon"]:checked')].map((el) => el.value).includes(o.id)
      );
      let price = round2(activeItem.menuItemPriceAmount);
      price = round2(price + size.delta + milk.delta);
      for (const a of addons) price = round2(price + a.delta);
      const detail = [size.label, `${milk.label} milk`, ...addons.map((a) => a.label)].join(', ');
      addLine(activeItem, detail, price);
      modal.hidden = true;
      activeItem = null;
    });

    // confirm.js's preparePayload() reads line.menuItem.menu_item_identifier
    // (snake_case) even though listMenuItems() itself returns camelCase
    // fields — see menu.js's own comment on that mapping. Storing both
    // shapes on menuItem keeps this line compatible with confirm.js as-is.
    function addLine(item, detail, price) {
      currentOrder.push({
        menuItem: { menu_item_identifier: item.menuItemIdentifier, menu_item_name: item.menuItemName },
        quantity: 1,
        customization: detail,
        lineTotal: price,
      });
      renderOrder();
    }

    function renderOrder() {
      orderList.innerHTML = '';
      orderEmpty.hidden = currentOrder.length > 0;
      let subtotal = 0;

      currentOrder.forEach((line, index) => {
        subtotal += line.lineTotal;
        const li = document.createElement('li');
        li.className = 'order-line';
        const info = document.createElement('div');
        const name = document.createElement('p');
        name.textContent = line.menuItem.menu_item_name;
        info.appendChild(name);
        if (line.customization && line.customization !== 'None') {
          const detail = document.createElement('p');
          detail.className = 'order-line-detail';
          detail.textContent = line.customization;
          info.appendChild(detail);
        }
        const price = document.createElement('span');
        price.textContent = formatPrice(line.lineTotal);
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'order-line-remove';
        removeBtn.textContent = '\u00d7';
        removeBtn.addEventListener('click', () => {
          currentOrder.splice(index, 1);
          renderOrder();
        });
        li.append(info, price, removeBtn);
        orderList.appendChild(li);
      });

      subtotalEl.textContent = formatPrice(round2(subtotal));
      const tax = round2(subtotal * TAX_RATE);
      taxEl.textContent = formatPrice(tax);
      totalEl.textContent = formatPrice(round2(subtotal + tax));
    }

    const { data, error } = await listMenuItems();
    if (error) {
      menuRows.innerHTML = `<tr><td colspan="3" class="error">${error.message}</td></tr>`;
      return;
    }
    allItems = data;
    const categories = [...new Set(allItems.map((i) => i.menuItemCategoryType))];
    activeCategory = categories[0];
    renderTabs(categories);
    renderRows();
    renderOrder();
  },
};