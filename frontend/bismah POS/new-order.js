// src/new-order.js
//
// Migrated from the standalone frontend/Neworder.js prototype into this
// screen-function pattern. Menu browsing + customization + order list.
// Deliberately does NOT touch menu.js/confirm.js (other tickets) — this
// is its own screen, reusing the shared classes already defined in
// style.css (.screen-container, .category-section, .items-grid,
// .menu-item-btn, .item-disabled) rather than inventing new ones.

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

// Round at each step, not at the end — see frontend/README.md "Things
// that will bite you".
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
        <h2>Menu</h2>
        <div id="menu-sections"></div>
      </section>
      <aside class="screen-container order-panel" aria-label="Current order">
        <h2>Order</h2>
        <ul id="order-list" class="order-list"></ul>
        <p id="order-empty" class="order-empty">No items added yet.</p>
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

  let order = [];
  let activeItem = null;
  let nextLineId = 1;

  const menuSections = container.querySelector('#menu-sections');
  const orderList = container.querySelector('#order-list');
  const orderEmpty = container.querySelector('#order-empty');
  const modal = container.querySelector('#customize-modal');
  const modalTitle = container.querySelector('#customize-title');
  const sizeOptionsEl = container.querySelector('#size-options');
  const milkOptionsEl = container.querySelector('#milk-options');
  const addonOptionsEl = container.querySelector('#addon-options');
  const modalCancel = container.querySelector('#modal-cancel');
  const modalAdd = container.querySelector('#modal-add');

  function renderMenu(menuItems) {
    const categories = [...new Set(menuItems.map((item) => item.menu_item_category_type))];
    menuSections.innerHTML = '';

    for (const category of categories) {
      const section = document.createElement('section');
      section.className = 'category-section';

      const heading = document.createElement('h3');
      heading.textContent = category;
      section.appendChild(heading);

      const grid = document.createElement('div');
      grid.className = 'items-grid';

      for (const item of menuItems.filter((i) => i.menu_item_category_type === category)) {
        grid.appendChild(renderMenuItemButton(item));
      }

      section.appendChild(grid);
      menuSections.appendChild(section);
    }
  }

  function renderMenuItemButton(item) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'menu-item-btn';
    btn.disabled = !item.menu_item_availability_status;
    if (!item.menu_item_availability_status) btn.classList.add('item-disabled');

    const name = document.createElement('span');
    name.textContent = item.menu_item_name;
    const price = document.createElement('span');
    price.textContent = item.menu_item_availability_status
      ? formatPrice(item.menu_item_price_amount)
      : 'Unavailable';

    btn.append(name, price);

    btn.addEventListener('click', () => {
      if (!item.menu_item_availability_status) return;
      if (CUSTOMIZABLE_CATEGORIES.includes(item.menu_item_category_type)) {
        openCustomizeModal(item);
      } else {
        addLineToOrder({ name: item.menu_item_name, detail: '', price: round2(item.menu_item_price_amount) });
      }
    });

    return btn;
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
  }

  (async function init() {
    const { data, error } = await listMenuItems();
    if (error) {
      menuSections.innerHTML = '<p class="error">Couldn\u2019t load the menu. Try refreshing.</p>';
      return;
    }
    renderMenu(data);
  })();
}
