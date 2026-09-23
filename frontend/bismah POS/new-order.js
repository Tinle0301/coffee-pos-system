// src/new-order.js
import { listMenuItems } from './menu.stub.js';

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

const CUSTOMIZABLE_CATEGORIES = ['Espresso', 'Tea'];
const TAX_RATE = 0.1025; // see frontend/README.md "Things that will bite you"

// Round at each step, not at the end.
function round2(amount) {
  return Math.round(amount * 100) / 100;
}

function formatPrice(amount) {
  return `$${amount.toFixed(2)}`;
}

/**
 * Renders the New Order screen into `container`.
 * @param {HTMLElement} container
 */
export function renderNewOrderScreen(container) {
  container.innerHTML = `
    <div class="new-order-layout">
      <section class="screen-container menu-panel" aria-label="Menu">
        <h2>New Order</h2>
        <div id="category-tabs" class="category-tabs" role="tablist"></div>
        <table class="menu-table">
          <thead>
            <tr><th>Item</th><th>Price</th><th></th></tr>
          </thead>
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
      </aside>
    </div>

    <div id="customize-modal" class="modal-overlay" hidden>
      <div class="screen-container modal-card" role="dialog" aria-modal="true" aria-labelledby="customize-title">
        <h2 id="customize-title"></h2>
        <fieldset class="modal-field">
          <legend>Size</legend>
          <div id="size-options" class="option-row"></div>
        </fieldset>
        <fieldset class="modal-field">
          <legend>Milk</legend>
          <div id="milk-options" class="option-row"></div>
        </fieldset>
        <fieldset class="modal-field">
          <legend>Add-ons</legend>
          <div id="addon-options" class="option-col"></div>
        </fieldset>
        <div class="modal-actions">
          <button type="button" id="modal-cancel" class="btn-ghost">Cancel</button>
          <button type="button" id="modal-add">Add to order</button>
        </div>
      </div>
    </div>
  `;

  let allItems = [];
  let activeCategory = null;
  let order = [];
  let activeItem = null;
  let nextLineId = 1;

  const categoryTabs = container.querySelector('#category-tabs');
  const menuRows = container.querySelector('#menu-rows');
  const orderList = container.querySelector('#order-list');
  const orderEmpty = container.querySelector('#order-empty');
  const subtotalEl = container.querySelector('#order-subtotal');
  const taxEl = container.querySelector('#order-tax');
  const totalEl = container.querySelector('#order-total');
  const modal = container.querySelector('#customize-modal');
  const modalTitle = container.querySelector('#customize-title');
  const sizeOptionsEl = container.querySelector('#size-options');
  const milkOptionsEl = container.querySelector('#milk-options');
  const addonOptionsEl = container.querySelector('#addon-options');
  const modalCancel = container.querySelector('#modal-cancel');
  const modalAdd = container.querySelector('#modal-add');

  function renderTabs(categories) {
    categoryTabs.innerHTML = '';
    categories.forEach((category) => {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'category-tab' + (category === activeCategory ? ' active' : '');
      tab.textContent = category;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(category === activeCategory));
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
    const itemsInCategory = allItems.filter((i) => i.menu_item_category_type === activeCategory);

    for (const item of itemsInCategory) {
      const tr = document.createElement('tr');
      if (!item.menu_item_availability_status) tr.classList.add('menu-row-unavailable');

      const nameTd = document.createElement('td');
      nameTd.className = 'menu-row-name';
      nameTd.textContent = item.menu_item_name;

      const priceTd = document.createElement('td');
      priceTd.className = 'menu-row-price';
      priceTd.textContent = item.menu_item_availability_status
        ? formatPrice(item.menu_item_price_amount)
        : 'Unavailable';

      const actionTd = document.createElement('td');
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'add-btn';
      addBtn.textContent = 'Add';
      addBtn.disabled = !item.menu_item_availability_status;
      addBtn.addEventListener('click', () => {
        if (CUSTOMIZABLE_CATEGORIES.includes(item.menu_item_category_type)) {
          openCustomizeModal(item);
        } else {
          addLineToOrder({ name: item.menu_item_name, detail: '', price: round2(item.menu_item_price_amount) });
        }
      });
      actionTd.appendChild(addBtn);

      tr.append(nameTd, priceTd, actionTd);
      menuRows.appendChild(tr);
    }
  }

  function openCustomizeModal(item) {
    activeItem = item;
    modalTitle.textContent = item.menu_item_name;

    sizeOptionsEl.innerHTML = '';
    SIZE_OPTIONS.forEach((opt, i) => sizeOptionsEl.appendChild(renderRadio('size', opt, i === 0)));

    milkOptionsEl.innerHTML = '';
    MILK_OPTIONS.forEach((opt, i) => milkOptionsEl.appendChild(renderRadio('milk', opt, i === 0)));

    addonOptionsEl.innerHTML = '';
    ADDON_OPTIONS.forEach((opt) => addonOptionsEl.appendChild(renderCheckbox('addon', opt)));

    modal.hidden = false;
  }

  function renderRadio(groupName, opt, checked) {
    const label = document.createElement('label');
    label.className = 'option-pill';
    label.innerHTML = `<input type="radio" name="${groupName}" value="${opt.id}" ${checked ? 'checked' : ''} /> <span>${opt.label}${opt.delta > 0 ? ` (+${formatPrice(opt.delta)})` : ''}</span>`;
    return label;
  }

  function renderCheckbox(groupName, opt) {
    const label = document.createElement('label');
    label.className = 'option-pill';
    label.innerHTML = `<input type="checkbox" name="${groupName}" value="${opt.id}" /> <span>${opt.label}${opt.delta > 0 ? ` (+${formatPrice(opt.delta)})` : ''}</span>`;
    return label;
  }

  function closeModal() {
    modal.hidden = true;
    activeItem = null;
  }

  modalCancel.addEventListener('click', closeModal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });

  modalAdd.addEventListener('click', () => {
    if (!activeItem) return;

    const size = SIZE_OPTIONS.find((o) => o.id === modal.querySelector('input[name="size"]:checked').value);
    const milk = MILK_OPTIONS.find((o) => o.id === modal.querySelector('input[name="milk"]:checked').value);
    const addons = ADDON_OPTIONS.filter((o) =>
      [...modal.querySelectorAll('input[name="addon"]:checked')].map((el) => el.value).includes(o.id)
    );

    let price = round2(activeItem.menu_item_price_amount);
    price = round2(price + size.delta);
    price = round2(price + milk.delta);
    for (const addon of addons) price = round2(price + addon.delta);

    addLineToOrder({
      name: activeItem.menu_item_name,
      detail: [size.label, `${milk.label} milk`, ...addons.map((a) => a.label)].join(', '),
      price,
    });

    closeModal();
  });

  function addLineToOrder(line) {
    order.push({ id: nextLineId++, ...line });
    renderOrder();
  }

  function removeLineFromOrder(id) {
    order = order.filter((line) => line.id !== id);
    renderOrder();
  }

  function renderOrder() {
    orderList.innerHTML = '';
    orderEmpty.hidden = order.length > 0;

    for (const line of order) {
      const li = document.createElement('li');
      li.className = 'order-line';

      const info = document.createElement('div');
      const name = document.createElement('p');
      name.textContent = line.name;
      info.appendChild(name);
      if (line.detail) {
        const detail = document.createElement('p');
        detail.className = 'order-line-detail';
        detail.textContent = line.detail;
        info.appendChild(detail);
      }

      const price = document.createElement('span');
      price.textContent = formatPrice(line.price);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'order-line-remove';
      removeBtn.setAttribute('aria-label', `Remove ${line.name}`);
      removeBtn.textContent = '\u00d7';
      removeBtn.addEventListener('click', () => removeLineFromOrder(line.id));

      li.append(info, price, removeBtn);
      orderList.appendChild(li);
    }

    const subtotal = round2(order.reduce((sum, line) => sum + line.price, 0));
    const tax = round2(subtotal * TAX_RATE);
    const total = round2(subtotal + tax);

    subtotalEl.textContent = formatPrice(subtotal);
    taxEl.textContent = formatPrice(tax);
    totalEl.textContent = formatPrice(total);
  }

  (async function init() {
    const { data, error } = await listMenuItems();
    if (error) {
      menuRows.innerHTML = '<tr><td colspan="3" class="error">Couldn\u2019t load the menu. Try refreshing.</td></tr>';
      return;
    }
    allItems = data;
    const categories = [...new Set(allItems.map((item) => item.menu_item_category_type))];
    activeCategory = categories[0];
    renderTabs(categories);
    renderRows();
    renderOrder();
  })();
}